-- Create wallet balances table
CREATE TABLE public.wallet_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  balance_eur DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  balance_btc DECIMAL(16,8) NOT NULL DEFAULT 0.00000000,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create bitcoin addresses table
CREATE TABLE public.bitcoin_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  address TEXT NOT NULL UNIQUE,
  private_key_encrypted TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, is_active) -- Only one active address per user
);

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'purchase', 'refund')),
  amount_eur DECIMAL(10,2) NOT NULL,
  amount_btc DECIMAL(16,8) NOT NULL DEFAULT 0.00000000,
  btc_tx_hash TEXT,
  btc_confirmations INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMP WITH TIME ZONE
);

-- Create orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  total_amount_eur DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create order items table
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  price_eur DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.wallet_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bitcoin_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for wallet_balances
CREATE POLICY "Users can view their own wallet balance" 
ON public.wallet_balances 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own wallet balance" 
ON public.wallet_balances 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert wallet balance" 
ON public.wallet_balances 
FOR INSERT 
WITH CHECK (true);

-- RLS policies for bitcoin_addresses
CREATE POLICY "Users can view their own bitcoin addresses" 
ON public.bitcoin_addresses 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert bitcoin addresses" 
ON public.bitcoin_addresses 
FOR INSERT 
WITH CHECK (true);

-- RLS policies for transactions
CREATE POLICY "Users can view their own transactions" 
ON public.transactions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert transactions" 
ON public.transactions 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update transactions" 
ON public.transactions 
FOR UPDATE 
USING (true);

-- RLS policies for orders
CREATE POLICY "Users can view their own orders" 
ON public.orders 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own orders" 
ON public.orders 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own orders" 
ON public.orders 
FOR UPDATE 
USING (auth.uid() = user_id);

-- RLS policies for order_items
CREATE POLICY "Users can view their own order items" 
ON public.order_items 
FOR SELECT 
USING (auth.uid() IN (SELECT user_id FROM orders WHERE id = order_id));

CREATE POLICY "Users can create order items for their orders" 
ON public.order_items 
FOR INSERT 
WITH CHECK (auth.uid() IN (SELECT user_id FROM orders WHERE id = order_id));

-- Create triggers for updated_at
CREATE TRIGGER update_wallet_balances_updated_at
BEFORE UPDATE ON public.wallet_balances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to get or create wallet balance
CREATE OR REPLACE FUNCTION public.get_or_create_wallet_balance(user_uuid UUID)
RETURNS TABLE(balance_eur DECIMAL, balance_btc DECIMAL) AS $$
BEGIN
  -- Try to get existing balance
  RETURN QUERY
  SELECT wb.balance_eur, wb.balance_btc
  FROM public.wallet_balances wb
  WHERE wb.user_id = user_uuid;
  
  -- If no balance exists, create one
  IF NOT FOUND THEN
    INSERT INTO public.wallet_balances (user_id, balance_eur, balance_btc)
    VALUES (user_uuid, 0.00, 0.00000000);
    
    RETURN QUERY
    SELECT wb.balance_eur, wb.balance_btc
    FROM public.wallet_balances wb
    WHERE wb.user_id = user_uuid;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;