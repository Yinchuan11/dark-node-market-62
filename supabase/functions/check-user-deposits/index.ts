import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SATS = 1e8;
const TOLERANCE = 2 / SATS; // ±2 sats/litoshis

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Checking user deposits...');

    // Get all active user addresses
    const { data: userAddresses, error: addressError } = await supabase
      .from('user_addresses')
      .select('user_id, currency, address')
      .eq('is_active', true);

    if (addressError) throw addressError;

    // Get current crypto prices
    const [btcResponse, ltcResponse] = await Promise.all([
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur'),
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=litecoin&vs_currencies=eur')
    ]);

    const btcData = await btcResponse.json();
    const ltcData = await ltcResponse.json();
    const BTC_EUR = btcData.bitcoin.eur as number;
    const LTC_EUR = ltcData.litecoin.eur as number;

    let processedCount = 0;

    // Process each address
    for (const userAddr of userAddresses) {
      try {
        let apiUrl = '';
        let currentPrice = 0;
        
        if (userAddr.currency === 'BTC') {
          apiUrl = `https://mempool.space/api/address/${userAddr.address}/txs`;
          currentPrice = BTC_EUR;
        } else if (userAddr.currency === 'LTC') {
          apiUrl = `https://api.blockcypher.com/v1/ltc/main/addrs/${userAddr.address}/full`;
          currentPrice = LTC_EUR;
        } else {
          continue;
        }

        console.log(`Checking ${userAddr.currency} address: ${userAddr.address}`);

        const response = await fetch(apiUrl);
        if (!response.ok) {
          console.error(`API error for ${userAddr.currency}:`, response.statusText);
          continue;
        }

        let transactions = [];
        
        if (userAddr.currency === 'BTC') {
          transactions = await response.json();
        } else {
          // LTC from BlockCypher
          const data = await response.json();
          transactions = data.txs || [];
        }

        for (const tx of transactions) {
          let amountSats = 0;
          let txHash = tx.hash;

          // Calculate amount received to this address
          if (userAddr.currency === 'BTC') {
            for (const vout of tx.vout || []) {
              if (vout.scriptpubkey_address === userAddr.address) {
                amountSats += vout.value;
              }
            }
          } else {
            // LTC
            for (const output of tx.outputs || []) {
              if (output.addresses && output.addresses.includes(userAddr.address)) {
                amountSats += output.value;
              }
            }
          }

          if (amountSats <= 0) continue;

          const amountCrypto = amountSats / SATS;

          // Check if we already processed this transaction
          const { data: existingTx } = await supabase
            .from('transactions')
            .select('id')
            .eq('btc_tx_hash', txHash)
            .eq('user_id', userAddr.user_id)
            .maybeSingle();

          if (existingTx) continue;

          // Find matching pending deposit request
          const minAmt = amountCrypto - TOLERANCE;
          const maxAmt = amountCrypto + TOLERANCE;
          const now = new Date();

          const { data: requests, error: reqErr } = await supabase
            .from('deposit_requests')
            .select('id, user_id, requested_eur, crypto_amount, rate_locked, created_at, expires_at')
            .eq('user_id', userAddr.user_id)
            .eq('currency', userAddr.currency)
            .eq('status', 'pending')
            .gte('crypto_amount', minAmt)
            .lte('crypto_amount', maxAmt)
            .gt('expires_at', now.toISOString())
            .limit(1);

          if (reqErr) throw reqErr;
          if (!requests || requests.length === 0) continue;

          const request = requests[0];

          // Get confirmations
          let confirmations = 0;
          if (userAddr.currency === 'BTC' && tx.status?.confirmed && tx.status.block_height) {
            const tipRes = await fetch('https://mempool.space/api/blocks/tip/height');
            const tip = await tipRes.json();
            confirmations = Math.max(0, tip - tx.status.block_height + 1);
          } else if (userAddr.currency === 'LTC' && tx.confirmations) {
            confirmations = tx.confirmations;
          }

          // Mark request as received/confirmed
          await supabase
            .from('deposit_requests')
            .update({
              status: confirmations >= 1 ? 'confirmed' : 'received',
              tx_hash: txHash,
              confirmations: confirmations
            })
            .eq('id', request.id);

          // Create transaction record
          const amountEur = request.requested_eur;
          await supabase.from('transactions').insert({
            user_id: request.user_id,
            type: 'deposit',
            amount_eur: amountEur,
            amount_btc: userAddr.currency === 'BTC' ? amountCrypto : 0,
            btc_tx_hash: txHash,
            btc_confirmations: confirmations,
            status: confirmations >= 1 ? 'completed' : 'pending',
            description: `${userAddr.currency} deposit (individual address)`
          });

          // Update wallet balance if confirmed
          if (confirmations >= 1) {
            const { data: bal } = await supabase
              .from('wallet_balances')
              .select('balance_eur, balance_btc, balance_ltc, balance_btc_deposited, balance_ltc_deposited')
              .eq('user_id', request.user_id)
              .maybeSingle();

            const updateData: any = {};
            
            if (bal) {
              updateData.balance_eur = Number(bal.balance_eur) + amountEur;
              
              if (userAddr.currency === 'BTC') {
                updateData.balance_btc = Number(bal.balance_btc) + amountCrypto;
                updateData.balance_btc_deposited = Number(bal.balance_btc_deposited || 0) + amountCrypto;
              } else {
                updateData.balance_ltc = Number(bal.balance_ltc) + amountCrypto;
                updateData.balance_ltc_deposited = Number(bal.balance_ltc_deposited || 0) + amountCrypto;
              }

              await supabase
                .from('wallet_balances')
                .update(updateData)
                .eq('user_id', request.user_id);
            } else {
              // Create new balance
              const newBalance: any = {
                user_id: request.user_id,
                balance_eur: amountEur,
                balance_btc: 0,
                balance_ltc: 0,
                balance_btc_deposited: 0,
                balance_ltc_deposited: 0
              };

              if (userAddr.currency === 'BTC') {
                newBalance.balance_btc = amountCrypto;
                newBalance.balance_btc_deposited = amountCrypto;
              } else {
                newBalance.balance_ltc = amountCrypto;
                newBalance.balance_ltc_deposited = amountCrypto;
              }

              await supabase
                .from('wallet_balances')
                .insert(newBalance);
            }

            console.log(`Credited ${amountEur} EUR (${amountCrypto} ${userAddr.currency}) to user ${request.user_id}`);
            processedCount++;
          }
        }
      } catch (error) {
        console.error(`Error processing ${userAddr.currency} address ${userAddr.address}:`, error);
        continue;
      }
    }

    console.log(`Processed ${processedCount} new deposits`);
    return new Response(
      JSON.stringify({ ok: true, processed: processedCount }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('Error in check-user-deposits:', e);
    return new Response(
      JSON.stringify({ error: String(e) }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});