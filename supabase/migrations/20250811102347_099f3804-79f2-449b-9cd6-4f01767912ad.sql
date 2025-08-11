-- Reset all wallet balances to zero
UPDATE public.wallet_balances
SET balance_eur = 0.00,
    balance_btc = 0.00000000,
    balance_ltc = 0.00000000,
    balance_btc_deposited = 0.00000000,
    balance_ltc_deposited = 0.00000000,
    updated_at = now();

-- Clear all transactions (test data)
DELETE FROM public.transactions;

-- Clear all orders and their items (test data)
DELETE FROM public.order_items;
DELETE FROM public.orders;
