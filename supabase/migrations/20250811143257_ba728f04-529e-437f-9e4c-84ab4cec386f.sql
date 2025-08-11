-- Add Monero support to existing tables
ALTER TABLE wallet_balances ADD COLUMN balance_xmr numeric DEFAULT 0.00000000 NOT NULL;
ALTER TABLE wallet_balances ADD COLUMN balance_xmr_deposited numeric DEFAULT 0.00000000 NOT NULL;

-- Update user_addresses to support Monero
INSERT INTO user_addresses (user_id, currency, address) 
SELECT user_id, 'XMR', 'pending' FROM user_addresses WHERE currency = 'BTC' GROUP BY user_id;

-- Create dispute resolution tables
CREATE TABLE public.disputes (
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

CREATE TABLE public.dispute_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create bulk discounts table
CREATE TABLE public.bulk_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  min_quantity INTEGER NOT NULL CHECK (min_quantity > 0),
  discount_percentage NUMERIC NOT NULL CHECK (discount_percentage > 0 AND discount_percentage <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add withdrawal fees for Monero
INSERT INTO withdrawal_fees (currency, base_fee_eur, percentage_fee, network_fee_crypto, min_amount_eur) 
VALUES ('XMR', 2.50, 0.025, 0.0005, 15.00);

-- Enable RLS on new tables
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_discounts ENABLE ROW LEVEL SECURITY;

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

-- Create analytics views for sellers
CREATE OR REPLACE VIEW seller_analytics AS
SELECT 
  p.seller_id,
  COUNT(DISTINCT o.id) as total_orders,
  COUNT(DISTINCT oi.product_id) as products_sold,
  SUM(oi.quantity) as total_quantity_sold,
  SUM(oi.price_eur * oi.quantity) as total_revenue,
  AVG(oi.price_eur) as avg_order_value,
  DATE_TRUNC('month', o.created_at) as month
FROM products p
JOIN order_items oi ON p.id = oi.product_id
JOIN orders o ON oi.order_id = o.id
WHERE o.status = 'confirmed'
GROUP BY p.seller_id, DATE_TRUNC('month', o.created_at);

-- Grant access to the view
GRANT SELECT ON seller_analytics TO authenticated;