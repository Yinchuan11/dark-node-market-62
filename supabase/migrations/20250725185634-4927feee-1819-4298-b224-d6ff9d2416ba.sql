-- Deactivate old testnet address for admin user ADMkz
UPDATE bitcoin_addresses 
SET is_active = false 
WHERE user_id IN (
  SELECT user_id FROM profiles WHERE username = 'ADMkz'
) AND is_active = true;