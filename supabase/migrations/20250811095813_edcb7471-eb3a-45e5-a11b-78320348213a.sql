-- Create orders table with shipping fields if it doesn't exist
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  total_amount_eur NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  shipping_first_name TEXT,
  shipping_last_name TEXT,
  shipping_street TEXT,
  shipping_house_number TEXT,
  shipping_postal_code TEXT,
  shipping_city TEXT,
  shipping_country TEXT
);

-- Add missing shipping columns to orders table if they don't exist
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS shipping_first_name TEXT,
ADD COLUMN IF NOT EXISTS shipping_last_name TEXT,
ADD COLUMN IF NOT EXISTS shipping_street TEXT,
ADD COLUMN IF NOT EXISTS shipping_house_number TEXT,
ADD COLUMN IF NOT EXISTS shipping_postal_code TEXT,
ADD COLUMN IF NOT EXISTS shipping_city TEXT,
ADD COLUMN IF NOT EXISTS shipping_country TEXT;