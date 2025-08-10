-- Fix the search_path security issue for the new function
CREATE OR REPLACE FUNCTION public.auto_deactivate_product_on_zero_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stock = 0 AND OLD.stock > 0 THEN
    NEW.is_active = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = 'public';