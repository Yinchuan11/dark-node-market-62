import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get shared LTC address from environment
const SHARED_LTC_ADDRESS = Deno.env.get('SHARED_LTC_ADDRESS') || '';

const LITOSHI = 1e8;
const TOLERANCE = 2 / LITOSHI; // ±2 litoshis
const WINDOW_MINUTES = 45;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!SHARED_LTC_ADDRESS) {
      throw new Error('SHARED_LTC_ADDRESS not configured');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch recent txs for the shared LTC address
    const txRes = await fetch(`https://litecoinspace.org/api/address/${SHARED_LTC_ADDRESS}/txs`);
    if (!txRes.ok) throw new Error(`litecoinspace.org error: ${txRes.statusText}`);
    const txs = await txRes.json();

    // Current LTC-EUR rate
    const priceRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=litecoin&vs_currencies=eur');
    const priceJson = await priceRes.json();
    const LTC_EUR = priceJson.litecoin.eur as number;

    for (const tx of txs || []) {
      // Sum outputs to our shared address
      let amountLitoshi = 0;
      for (const vout of tx.vout || []) {
        if (vout.scriptpubkey_address === SHARED_LTC_ADDRESS) amountLitoshi += vout.value;
      }
      if (amountLitoshi <= 0) continue;

      const amountLtc = amountLitoshi / LITOSHI;

      // Skip if already processed
      const { data: existingDeposit } = await supabase
        .from('deposit_requests')
        .select('id')
        .eq('tx_hash', tx.hash)
        .maybeSingle();
      if (existingDeposit) continue;

      const now = new Date();

      // Find a matching pending deposit_request within tolerance and not expired
      const minAmt = amountLtc - TOLERANCE;
      const maxAmt = amountLtc + TOLERANCE;
      const { data: requests, error: reqErr } = await supabase
        .from('deposit_requests')
        .select('id, user_id, requested_eur, crypto_amount, rate_locked, created_at, expires_at')
        .eq('currency', 'LTC')
        .eq('status', 'pending')
        .gte('crypto_amount', minAmt)
        .lte('crypto_amount', maxAmt)
        .gt('expires_at', now.toISOString())
        .limit(1);
      if (reqErr) throw reqErr;
      if (!requests || requests.length === 0) continue;

      const request = requests[0];

      // Confirmations
      let confirmations = 0;
      if (tx.status?.confirmed && tx.status.block_height) {
        const tipRes = await fetch('https://litecoinspace.org/api/blocks/tip/height');
        const tip = await tipRes.json();
        confirmations = Math.max(0, tip - tx.status.block_height + 1);
      }

      await supabase
        .from('deposit_requests')
        .update({
          status: confirmations >= 1 ? 'confirmed' : 'received',
          tx_hash: tx.hash,
          confirmations: confirmations
        })
        .eq('id', request.id);

      const amountEur = request.requested_eur;
      await supabase.from('transactions').insert({
        user_id: request.user_id,
        type: 'deposit',
        amount_eur: amountEur,
        amount_btc: amountLtc, // store LTC amount here
        btc_tx_hash: tx.hash,
        btc_confirmations: confirmations,
        status: confirmations >= 1 ? 'completed' : 'pending',
        description: 'Litecoin deposit (shared address)'
      });

      if (confirmations >= 1) {
        const { data: bal } = await supabase
          .from('wallet_balances')
          .select('balance_eur, balance_ltc')
          .eq('user_id', request.user_id)
          .maybeSingle();
        if (bal) {
          await supabase
            .from('wallet_balances')
            .update({
              balance_eur: Number(bal.balance_eur) + amountEur,
              balance_ltc: Number((bal as any).balance_ltc || 0) + amountLtc,
            })
            .eq('user_id', request.user_id);
        } else {
          await supabase
            .from('wallet_balances')
            .insert({ user_id: request.user_id, balance_eur: amountEur, balance_btc: 0, balance_ltc: amountLtc });
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
