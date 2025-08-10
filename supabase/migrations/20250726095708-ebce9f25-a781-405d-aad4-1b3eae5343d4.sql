-- Add stock field to products table
ALTER TABLE public.products 
ADD COLUMN stock INTEGER NOT NULL DEFAULT 0;

-- Add Litecoin balance to wallet_balances table
ALTER TABLE public.wallet_balances 
ADD COLUMN balance_ltc NUMERIC(12,8) NOT NULL DEFAULT 0.00000000;

-- Drop existing function and recreate with Litecoin support
DROP FUNCTION public.get_or_create_wallet_balance(uuid);

CREATE OR REPLACE FUNCTION public.get_or_create_wallet_balance(user_uuid uuid)
 RETURNS TABLE(balance_eur numeric, balance_btc numeric, balance_ltc numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Try to get existing balance
  RETURN QUERY
  SELECT wb.balance_eur, wb.balance_btc, wb.balance_ltc
  FROM public.wallet_balances wb
  WHERE wb.user_id = user_uuid;
  
  -- If no balance exists, create one
  IF NOT FOUND THEN
    INSERT INTO public.wallet_balances (user_id, balance_eur, balance_btc, balance_ltc)
    VALUES (user_uuid, 0.00, 0.00000000, 0.00000000);
    
    RETURN QUERY
    SELECT wb.balance_eur, wb.balance_btc, wb.balance_ltc
    FROM public.wallet_balances wb
    WHERE wb.user_id = user_uuid;
  END IF;
END;
$function$;

-- Create trigger function to auto-deactivate products when stock reaches 0
CREATE OR REPLACE FUNCTION public.auto_deactivate_product_on_zero_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stock = 0 AND OLD.stock > 0 THEN
    NEW.is_active = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-deactivation
CREATE TRIGGER trigger_auto_deactivate_product
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_deactivate_product_on_zero_stock();