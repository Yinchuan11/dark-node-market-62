-- Fix withdrawal_fees constraint to allow XMR
ALTER TABLE withdrawal_fees DROP CONSTRAINT IF EXISTS withdrawal_fees_currency_check;
ALTER TABLE withdrawal_fees ADD CONSTRAINT withdrawal_fees_currency_check CHECK (currency IN ('BTC', 'LTC', 'XMR'));

-- Fix user_addresses constraint to allow XMR  
ALTER TABLE user_addresses DROP CONSTRAINT IF EXISTS user_addresses_currency_check;
ALTER TABLE user_addresses ADD CONSTRAINT user_addresses_currency_check CHECK (currency IN ('BTC', 'LTC', 'XMR'));

-- Add Monero support to existing tables
ALTER TABLE wallet_balances ADD COLUMN IF NOT EXISTS balance_xmr numeric DEFAULT 0.00000000 NOT NULL;
ALTER TABLE wallet_balances ADD COLUMN IF NOT EXISTS balance_xmr_deposited numeric DEFAULT 0.00000000 NOT NULL;

-- Update user_addresses to support Monero
INSERT INTO user_addresses (user_id, currency, address) 
SELECT user_id, 'XMR', 'pending' 
FROM user_addresses 
WHERE currency = 'BTC' 
AND user_id NOT IN (SELECT user_id FROM user_addresses WHERE currency = 'XMR')
GROUP BY user_id;

-- Add withdrawal fees for Monero
INSERT INTO withdrawal_fees (currency, base_fee_eur, percentage_fee, network_fee_crypto, min_amount_eur) 
SELECT 'XMR', 2.50, 0.025, 0.0005, 15.00
WHERE NOT EXISTS (SELECT 1 FROM withdrawal_fees WHERE currency = 'XMR');

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

-- Enable RLS
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for disputes
CREATE POLICY "Users can view disputes they are involved in" ON disputes
FOR SELECT USING (
  auth.uid() = plaintiff_id OR 
  auth.uid() = defendant_id OR 
  get_user_role(auth.uid()) = 'admin'
);

CREATE POLICY "Users can create disputes for their orders" ON disputes
FOR INSERT WITH CHECK (
  auth.uid() = plaintiff_id AND
  EXISTS (SELECT 1 FROM orders WHERE id = order_id AND user_id = auth.uid())
);

CREATE POLICY "Admins can update disputes" ON disputes
FOR UPDATE USING (get_user_role(auth.uid()) = 'admin');

-- Create dispute messages table
CREATE TABLE IF NOT EXISTS public.dispute_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE dispute_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for dispute messages
CREATE POLICY "Users can view messages in their disputes" ON dispute_messages
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM disputes 
    WHERE id = dispute_id AND 
    (plaintiff_id = auth.uid() OR defendant_id = auth.uid() OR get_user_role(auth.uid()) = 'admin')
  )
);

CREATE POLICY "Users can send messages in their disputes" ON dispute_messages
FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (
    SELECT 1 FROM disputes 
    WHERE id = dispute_id AND 
    (plaintiff_id = auth.uid() OR defendant_id = auth.uid() OR get_user_role(auth.uid()) = 'admin')
  )
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

ALTER TABLE bulk_discounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bulk discounts
CREATE POLICY "Everyone can view bulk discounts" ON bulk_discounts
FOR SELECT USING (true);

CREATE POLICY "Sellers can manage their product bulk discounts" ON bulk_discounts
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM products 
    WHERE id = product_id AND 
    (seller_id = auth.uid() OR get_user_role(auth.uid()) = 'admin')
  )
);

-- Create triggers for updated_at
CREATE TRIGGER update_disputes_updated_at
  BEFORE UPDATE ON disputes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bulk_discounts_updated_at
  BEFORE UPDATE ON bulk_discounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();