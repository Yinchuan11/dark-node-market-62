-- Add new transaction types and columns for better tracking
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS transaction_direction TEXT CHECK (transaction_direction IN ('incoming', 'outgoing')),
ADD COLUMN IF NOT EXISTS from_username TEXT,
ADD COLUMN IF NOT EXISTS to_username TEXT,
ADD COLUMN IF NOT EXISTS related_order_id UUID;

-- Update existing transactions to have proper direction
UPDATE transactions 
SET transaction_direction = CASE 
  WHEN type = 'deposit' THEN 'incoming'
  WHEN type = 'purchase' THEN 'outgoing'
  ELSE 'incoming'
END
WHERE transaction_direction IS NULL;