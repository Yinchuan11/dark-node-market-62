-- Create dummy users in auth.users table first
-- Note: This is a workaround for testing purposes only
-- In production, users should be created through proper signup flow

DO $$
DECLARE
    i INTEGER;
    new_user_id UUID;
    current_count INTEGER;
BEGIN
    -- Get current count
    SELECT COUNT(*) INTO current_count FROM profiles;
    
    -- Add users to reach 308 total
    FOR i IN (current_count + 1)..308 LOOP
        -- Generate a new UUID for each user
        new_user_id := gen_random_uuid();
        
        -- Insert into auth.users (this is normally handled by Supabase Auth)
        INSERT INTO auth.users (
            id,
            email,
            email_confirmed_at,
            created_at,
            updated_at,
            instance_id,
            aud,
            role
        ) VALUES (
            new_user_id,
            'testuser' || i || '@example.com',
            now(),
            now(),
            now(),
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated'
        );
        
        -- Insert corresponding profile
        INSERT INTO profiles (
            user_id,
            username,
            role
        ) VALUES (
            new_user_id,
            'testuser' || i,
            'user'
        );
    END LOOP;
END $$;