-- Fix transaction type check to allow 'sale'
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check CHECK (type IN ('deposit','withdrawal','purchase','sale'));

-- Fix orders status check to include 'confirmed' and 'pending' and 'cancelled'
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (status IN ('pending','confirmed','cancelled'));