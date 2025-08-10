import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get shared BTC address from environment
const SHARED_BTC_ADDRESS = Deno.env.get('SHARED_BTC_ADDRESS') || '';

const SATS = 1e8;
const TOLERANCE = 2 / SATS; // ±2 sats
const WINDOW_MINUTES = 45; // consider requests created within last 45 minutes

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!SHARED_BTC_ADDRESS) {
      throw new Error('SHARED_BTC_ADDRESS not configured');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch recent txs for the shared BTC address
    const txRes = await fetch(`https://mempool.space/api/address/${SHARED_BTC_ADDRESS}/txs`);
    if (!txRes.ok) throw new Error(`mempool.space error: ${txRes.statusText}`);
    const txs = await txRes.json();

    // Current BTC-EUR rate
    const priceRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur');
    const priceJson = await priceRes.json();
    const BTC_EUR = priceJson.bitcoin.eur as number;

    for (const tx of txs || []) {
      // Sum outputs to our shared address
      let amountSats = 0;
      for (const vout of tx.vout || []) {
        if (vout.scriptpubkey_address === SHARED_BTC_ADDRESS) amountSats += vout.value;
      }
      if (amountSats <= 0) continue;

      const amountBtc = amountSats / SATS;

      // Skip if we already processed this tx
      const { data: existingDeposit } = await supabase
        .from('deposit_requests')
        .select('id')
        .eq('tx_hash', tx.hash)
        .maybeSingle();
      if (existingDeposit) continue;

      const now = new Date();

      // Find a matching pending deposit_request within tolerance and not expired
      const minAmt = amountBtc - TOLERANCE;
      const maxAmt = amountBtc + TOLERANCE;
      const { data: requests, error: reqErr } = await supabase
        .from('deposit_requests')
        .select('id, user_id, requested_eur, crypto_amount, rate_locked, created_at, expires_at')
        .eq('currency', 'BTC')
        .eq('status', 'pending')
        .gte('crypto_amount', minAmt)
        .lte('crypto_amount', maxAmt)
        .gt('expires_at', now.toISOString())
        .limit(1);
      if (reqErr) throw reqErr;
      if (!requests || requests.length === 0) continue; // no matching request

      const request = requests[0];

      // Confirmations
      let confirmations = 0;
      if (tx.status?.confirmed && tx.status.block_height) {
        const tipRes = await fetch('https://mempool.space/api/blocks/tip/height');
        const tip = await tipRes.json();
        confirmations = Math.max(0, tip - tx.status.block_height + 1);
      }

      // Mark request as received/confirmed
      await supabase
        .from('deposit_requests')
        .update({
          status: confirmations >= 1 ? 'confirmed' : 'received',
          tx_hash: tx.hash,
          confirmations: confirmations
        })
        .eq('id', request.id);

      // Create deposit transaction
      const amountEur = request.requested_eur;
      await supabase.from('transactions').insert({
        user_id: request.user_id,
        type: 'deposit',
        amount_eur: amountEur,
        amount_btc: amountBtc,
        btc_tx_hash: tx.hash,
        btc_confirmations: confirmations,
        status: confirmations >= 1 ? 'completed' : 'pending',
        description: 'Bitcoin deposit (shared address)'
      });

      // Update wallet balance if confirmed
      if (confirmations >= 1) {
        const { data: bal } = await supabase
          .from('wallet_balances')
          .select('balance_eur, balance_btc')
          .eq('user_id', request.user_id)
          .maybeSingle();
        if (bal) {
          await supabase
            .from('wallet_balances')
            .update({
              balance_eur: Number(bal.balance_eur) + amountEur,
              balance_btc: Number(bal.balance_btc) + amountBtc,
            })
            .eq('user_id', request.user_id);
        } else {
          await supabase
            .from('wallet_balances')
            .insert({ user_id: request.user_id, balance_eur: amountEur, balance_btc: amountBtc, balance_ltc: 0 });
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
