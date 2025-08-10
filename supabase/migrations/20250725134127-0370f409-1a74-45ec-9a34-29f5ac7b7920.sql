-- Create admin user manually
-- First, insert into auth.users (this would normally be done by Supabase Auth)
-- We'll create a profile entry for the admin user instead

-- Insert admin profile (assuming we'll create the auth user via the auth system)
-- The user will need to sign up first with the credentials, then we'll update their role

-- Create a function to update user role to admin
CREATE OR REPLACE FUNCTION public.make_user_admin(user_email TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Find the user ID by email from auth.users
  SELECT au.id INTO target_user_id
  FROM auth.users au
  WHERE au.email = user_email;
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', user_email;
  END IF;
  
  -- Update the user's role to admin
  UPDATE public.profiles 
  SET role = 'admin'
  WHERE user_id = target_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile for user % not found', user_email;
  END IF;
END;
$$;