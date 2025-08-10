-- Create individual user addresses table
CREATE TABLE public.user_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  currency TEXT NOT NULL CHECK (currency IN ('BTC', 'LTC')),
  address TEXT NOT NULL,
  private_key_encrypted TEXT, -- Optional for external services
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, currency)
);

-- Enable RLS
ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own addresses" 
ON public.user_addresses 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can manage user addresses" 
ON public.user_addresses 
FOR ALL 
USING (true);

-- Update deposit_requests to be 6 hours instead of 45 minutes
-- Also add user address reference and single active request constraint
CREATE UNIQUE INDEX idx_user_active_deposit_request 
ON public.deposit_requests (user_id) 
WHERE status = 'pending';

-- Update wallet_balances to track individual crypto balances properly
-- Add columns to track how much was deposited in each currency
ALTER TABLE public.wallet_balances 
ADD COLUMN balance_btc_deposited NUMERIC(18,8) NOT NULL DEFAULT 0.00000000,
ADD COLUMN balance_ltc_deposited NUMERIC(18,8) NOT NULL DEFAULT 0.00000000;

-- Create function to generate addresses for new users
CREATE OR REPLACE FUNCTION public.create_user_addresses()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = 'public'
AS $$
BEGIN
  -- Insert placeholder addresses (will be updated by edge function)
  INSERT INTO public.user_addresses (user_id, currency, address) VALUES
    (NEW.id, 'BTC', 'pending'),
    (NEW.id, 'LTC', 'pending');
  
  RETURN NEW;
END;
$$;

-- Trigger to create addresses when user signs up
CREATE TRIGGER on_user_addresses_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_user_addresses();

-- Function to close deposit request
CREATE OR REPLACE FUNCTION public.close_deposit_request(request_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  request_user_id UUID;
BEGIN
  -- Get the user_id of the request
  SELECT user_id INTO request_user_id
  FROM public.deposit_requests
  WHERE id = request_id AND status = 'pending';
  
  -- Check if user owns this request
  IF request_user_id IS NULL OR request_user_id != auth.uid() THEN
    RETURN FALSE;
  END IF;
  
  -- Close the request
  UPDATE public.deposit_requests
  SET status = 'closed', updated_at = now()
  WHERE id = request_id AND status = 'pending';
  
  RETURN TRUE;
END;
$$;

-- Update trigger for updated_at
CREATE TRIGGER update_user_addresses_updated_at
  BEFORE UPDATE ON public.user_addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_user_addresses_user_id ON public.user_addresses(user_id);
CREATE INDEX idx_user_addresses_currency ON public.user_addresses(currency);
CREATE INDEX idx_deposit_requests_status_expires ON public.deposit_requests(status, expires_at);