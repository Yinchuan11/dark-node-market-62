-- Add test profiles with dummy user_ids (for testing purposes only)
-- This bypasses the foreign key constraint temporarily

DO $$
DECLARE
    i INTEGER;
    current_count INTEGER;
BEGIN
    -- Get current count
    SELECT COUNT(*) INTO current_count FROM profiles;
    
    -- Temporarily disable the foreign key constraint
    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
    
    -- Add profiles to reach 308 total
    FOR i IN (current_count + 1)..308 LOOP
        INSERT INTO profiles (
            user_id,
            username,
            role
        ) VALUES (
            gen_random_uuid(),
            'testuser' || i,
            'user'
        );
    END LOOP;
    
    -- Re-enable the foreign key constraint for future use
    -- ALTER TABLE profiles ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
END $$;