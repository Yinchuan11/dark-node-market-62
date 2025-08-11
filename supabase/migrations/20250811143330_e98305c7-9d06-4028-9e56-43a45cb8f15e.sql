-- First fix the currency constraint to allow XMR
ALTER TABLE user_addresses DROP CONSTRAINT IF EXISTS user_addresses_currency_check;
ALTER TABLE user_addresses ADD CONSTRAINT user_addresses_currency_check CHECK (currency IN ('BTC', 'LTC', 'XMR'));

-- Add Monero support to existing tables
ALTER TABLE wallet_balances ADD COLUMN IF NOT EXISTS balance_xmr numeric DEFAULT 0.00000000 NOT NULL;
ALTER TABLE wallet_balances ADD COLUMN IF NOT EXISTS balance_xmr_deposited numeric DEFAULT 0.00000000 NOT NULL;

-- Update user_addresses to support Monero (only if not already added)
INSERT INTO user_addresses (user_id, currency, address) 
SELECT user_id, 'XMR', 'pending' 
FROM user_addresses 
WHERE currency = 'BTC' 
AND user_id NOT IN (SELECT user_id FROM user_addresses WHERE currency = 'XMR')
GROUP BY user_id;

-- Create dispute resolution tables
CREATE TABLE IF NOT EXISTS public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  plaintiff_id UUID NOT NULL,
  defendant_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  admin_assigned UUID,
  resolution TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.dispute_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create bulk discounts table
CREATE TABLE IF NOT EXISTS public.bulk_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  min_quantity INTEGER NOT NULL CHECK (min_quantity > 0),
  discount_percentage NUMERIC NOT NULL CHECK (discount_percentage > 0 AND discount_percentage <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add withdrawal fees for Monero if not exists
INSERT INTO withdrawal_fees (currency, base_fee_eur, percentage_fee, network_fee_crypto, min_amount_eur) 
SELECT 'XMR', 2.50, 0.025, 0.0005, 15.00
WHERE NOT EXISTS (SELECT 1 FROM withdrawal_fees WHERE currency = 'XMR');

-- Enable RLS on new tables
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_discounts ENABLE ROW LEVEL SECURITY;