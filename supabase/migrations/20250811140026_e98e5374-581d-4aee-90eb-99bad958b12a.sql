-- Fix function search path issues by setting search_path parameter
CREATE OR REPLACE FUNCTION public.check_withdrawal_limits(
  user_uuid UUID,
  amount_eur NUMERIC
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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