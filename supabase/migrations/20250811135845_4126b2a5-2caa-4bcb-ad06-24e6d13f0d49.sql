-- Create withdrawal requests table
CREATE TABLE public.withdrawal_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount_eur NUMERIC(10,2) NOT NULL,
  amount_crypto NUMERIC(16,8) NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('BTC', 'LTC')),
  destination_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  tx_hash TEXT,
  fee_eur NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own withdrawal requests" 
ON public.withdrawal_requests 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own withdrawal requests" 
ON public.withdrawal_requests 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can update withdrawal requests" 
ON public.withdrawal_requests 
FOR UPDATE 
USING (true);

-- Create wallet security settings table
CREATE TABLE public.wallet_security (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
  withdrawal_limit_daily_eur NUMERIC(10,2) NOT NULL DEFAULT 500.00,
  withdrawal_limit_monthly_eur NUMERIC(10,2) NOT NULL DEFAULT 5000.00,
  last_withdrawal_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wallet_security ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own security settings" 
ON public.wallet_security 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own security settings" 
ON public.wallet_security 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own security settings" 
ON public.wallet_security 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create function to check withdrawal limits
CREATE OR REPLACE FUNCTION public.check_withdrawal_limits(
  user_uuid UUID,
  amount_eur NUMERIC
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  daily_limit NUMERIC;
  monthly_limit NUMERIC;
  daily_spent NUMERIC;
  monthly_spent NUMERIC;
BEGIN
  -- Get user limits
  SELECT withdrawal_limit_daily_eur, withdrawal_limit_monthly_eur
  INTO daily_limit, monthly_limit
  FROM public.wallet_security
  WHERE user_id = user_uuid;
  
  -- If no security settings exist, create defaults
  IF NOT FOUND THEN
    INSERT INTO public.wallet_security (user_id) VALUES (user_uuid);
    daily_limit := 500.00;
    monthly_limit := 5000.00;
  END IF;
  
  -- Calculate daily spent
  SELECT COALESCE(SUM(amount_eur), 0)
  INTO daily_spent
  FROM public.withdrawal_requests
  WHERE user_id = user_uuid
    AND status IN ('pending', 'processing', 'completed')
    AND created_at >= CURRENT_DATE;
  
  -- Calculate monthly spent
  SELECT COALESCE(SUM(amount_eur), 0)
  INTO monthly_spent
  FROM public.withdrawal_requests
  WHERE user_id = user_uuid
    AND status IN ('pending', 'processing', 'completed')
    AND created_at >= DATE_TRUNC('month', CURRENT_DATE);
  
  -- Check limits
  RETURN (daily_spent + amount_eur <= daily_limit) 
    AND (monthly_spent + amount_eur <= monthly_limit);
END;
$$;

-- Create trigger for updated_at
CREATE TRIGGER update_withdrawal_requests_updated_at
BEFORE UPDATE ON public.withdrawal_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_wallet_security_updated_at
BEFORE UPDATE ON public.wallet_security
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add withdrawal fee configuration
CREATE TABLE public.withdrawal_fees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  currency TEXT NOT NULL CHECK (currency IN ('BTC', 'LTC')),
  min_amount_eur NUMERIC(10,2) NOT NULL DEFAULT 10.00,
  base_fee_eur NUMERIC(10,2) NOT NULL DEFAULT 2.00,
  percentage_fee NUMERIC(5,4) NOT NULL DEFAULT 0.0200, -- 2%
  network_fee_crypto NUMERIC(16,8) NOT NULL DEFAULT 0.00001000,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(currency)
);

-- Insert default fees
INSERT INTO public.withdrawal_fees (currency, min_amount_eur, base_fee_eur, percentage_fee, network_fee_crypto) VALUES
('BTC', 20.00, 3.00, 0.0250, 0.00001000),
('LTC', 10.00, 1.50, 0.0200, 0.00100000);

-- Enable RLS
ALTER TABLE public.withdrawal_fees ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Anyone can view withdrawal fees" 
ON public.withdrawal_fees 
FOR SELECT 
USING (true);

CREATE POLICY "Only admins can manage withdrawal fees" 
ON public.withdrawal_fees 
FOR ALL 
USING (get_user_role(auth.uid()) = 'admin'::user_role);

-- Create trigger for updated_at
CREATE TRIGGER update_withdrawal_fees_updated_at
BEFORE UPDATE ON public.withdrawal_fees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();