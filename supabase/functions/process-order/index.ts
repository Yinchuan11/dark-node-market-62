import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type CartItem = { id: string; quantity: number };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const { userId, items, method, btcPrice, ltcPrice } = body as {
      userId: string;
      items: CartItem[];
      method: 'btc' | 'ltc';
      btcPrice?: number;
      ltcPrice?: number;
    };

    if (!userId || !items?.length || !method) throw new Error('Invalid payload');

    // Load product info and compute totals + amounts per seller
    const sellerTotals: Record<string, { eur: number; btc: number; ltc: number }> = {};
    let totalEUR = 0;

    for (const it of items) {
      const { data: product, error } = await supabase
        .from('products')
        .select('id, price, seller_id, stock')
        .eq('id', it.id)
        .maybeSingle();
      if (error || !product) throw error ?? new Error('Product not found');
      if (product.stock < it.quantity) throw new Error('Insufficient stock');

      const lineEUR = Number(product.price) * it.quantity;
      totalEUR += lineEUR;

      const btcAmt = btcPrice ? lineEUR / btcPrice : 0;
      const ltcAmt = ltcPrice ? lineEUR / ltcPrice : 0;

      const s = sellerTotals[product.seller_id] || { eur: 0, btc: 0, ltc: 0 };
      s.eur += lineEUR;
      s.btc += btcAmt;
      s.ltc += ltcAmt;
      sellerTotals[product.seller_id] = s;
    }

    // Check buyer balance
    const { data: buyerBal } = await supabase
      .from('wallet_balances')
      .select('balance_eur, balance_btc, balance_ltc')
      .eq('user_id', userId)
      .maybeSingle();
    if (!buyerBal) throw new Error('Buyer wallet not found');

    const totalBTC = method === 'btc' ? (totalEUR / (btcPrice || 1)) : 0;
    const totalLTC = method === 'ltc' ? (totalEUR / (ltcPrice || 1)) : 0;

    if (method === 'btc' && Number(buyerBal.balance_btc) + 1e-12 < totalBTC) throw new Error('Insufficient BTC balance');
    if (method === 'ltc' && Number((buyerBal as any).balance_ltc || 0) + 1e-12 < totalLTC) throw new Error('Insufficient LTC balance');

    // Create order
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({ user_id: userId, total_amount_eur: totalEUR, status: 'confirmed' })
      .select()
      .maybeSingle();
    if (orderErr || !order) throw orderErr ?? new Error('Order creation failed');

    // Create order items and update stock
    for (const it of items) {
      const { data: product } = await supabase
        .from('products')
        .select('id, price, stock')
        .eq('id', it.id)
        .maybeSingle();
      if (!product) throw new Error('Product missing');

      await supabase.from('order_items').insert({
        order_id: order.id,
        product_id: it.id,
        quantity: it.quantity,
        price_eur: product.price,
      });

      const newStock = Math.max(0, Number(product.stock) - it.quantity);
      await supabase.from('products').update({ stock: newStock }).eq('id', it.id);
    }

    // Deduct buyer balance and create buyer transaction
    if (method === 'btc') {
      await supabase.from('wallet_balances')
        .update({ balance_btc: Number(buyerBal.balance_btc) - totalBTC })
        .eq('user_id', userId);
      await supabase.from('transactions').insert({
        user_id: userId,
        type: 'purchase',
        amount_eur: -totalEUR,
        amount_btc: -totalBTC,
        status: 'confirmed',
        description: `Order #${String(order.id).slice(0,8)} (BTC)`,
        transaction_direction: 'outgoing',
        related_order_id: order.id
      });
    } else {
      await supabase.from('wallet_balances')
        .update({ balance_ltc: Number((buyerBal as any).balance_ltc || 0) - totalLTC })
        .eq('user_id', userId);
      await supabase.from('transactions').insert({
        user_id: userId,
        type: 'purchase',
        amount_eur: -totalEUR,
        amount_btc: -totalLTC, // store LTC amount here as convention
        status: 'confirmed',
        description: `Order #${String(order.id).slice(0,8)} (LTC)`,
        transaction_direction: 'outgoing',
        related_order_id: order.id
      });
    }

    // Get buyer username for transaction tracking
    const { data: buyerProfile } = await supabase
      .from('profiles')
      .select('username')
      .eq('user_id', userId)
      .maybeSingle();

    // Credit each seller and create seller transactions
    for (const [sellerId, sums] of Object.entries(sellerTotals)) {
      // Get seller username
      const { data: sellerProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('user_id', sellerId)
        .maybeSingle();

      if (method === 'btc') {
        const { data: sBal } = await supabase
          .from('wallet_balances')
          .select('balance_btc')
          .eq('user_id', sellerId)
          .maybeSingle();
        if (sBal) {
          await supabase.from('wallet_balances')
            .update({ balance_btc: Number(sBal.balance_btc) + sums.btc })
            .eq('user_id', sellerId);
        } else {
          await supabase.from('wallet_balances')
            .insert({ user_id: sellerId, balance_eur: 0, balance_btc: sums.btc, balance_ltc: 0 });
        }
        await supabase.from('transactions').insert({
          user_id: sellerId,
          type: 'sale',
          amount_eur: sums.eur,
          amount_btc: sums.btc,
          status: 'confirmed',
          description: `Sale #${String(order.id).slice(0,8)} (BTC)`,
          transaction_direction: 'incoming',
          from_username: buyerProfile?.username || 'Unknown',
          related_order_id: order.id
        });
      } else {
        const { data: sBal } = await supabase
          .from('wallet_balances')
          .select('balance_ltc')
          .eq('user_id', sellerId)
          .maybeSingle();
        if (sBal) {
          await supabase.from('wallet_balances')
            .update({ balance_ltc: Number((sBal as any).balance_ltc || 0) + sums.ltc })
            .eq('user_id', sellerId);
        } else {
          await supabase.from('wallet_balances')
            .insert({ user_id: sellerId, balance_eur: 0, balance_btc: 0, balance_ltc: sums.ltc });
        }
        await supabase.from('transactions').insert({
          user_id: sellerId,
          type: 'sale',
          amount_eur: sums.eur,
          amount_btc: sums.ltc, // store LTC amount here
          status: 'confirmed',
          description: `Sale #${String(order.id).slice(0,8)} (LTC)`,
          transaction_direction: 'incoming',
          from_username: buyerProfile?.username || 'Unknown',
          related_order_id: order.id
        });
      }
    }

    // Mark order as confirmed
    await supabase.from('orders').update({ status: 'confirmed' }).eq('id', order.id);

    return new Response(JSON.stringify({ ok: true, orderId: order.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error('process-order error:', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
