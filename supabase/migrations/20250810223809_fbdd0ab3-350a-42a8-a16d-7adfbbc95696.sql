-- Fix deposit_requests status constraint to allow 'closed' status
ALTER TABLE public.deposit_requests 
DROP CONSTRAINT IF EXISTS deposit_requests_status_check;

ALTER TABLE public.deposit_requests 
ADD CONSTRAINT deposit_requests_status_check 
CHECK (status IN ('pending', 'confirmed', 'expired', 'closed'));

-- Add shipping address to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS shipping_first_name text,
ADD COLUMN IF NOT EXISTS shipping_last_name text,
ADD COLUMN IF NOT EXISTS shipping_street text,
ADD COLUMN IF NOT EXISTS shipping_house_number text,
ADD COLUMN IF NOT EXISTS shipping_postal_code text,
ADD COLUMN IF NOT EXISTS shipping_city text,
ADD COLUMN IF NOT EXISTS shipping_country text;