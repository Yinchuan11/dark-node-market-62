-- Fix the handle_new_user function to handle duplicate usernames
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter INTEGER := 1;
BEGIN
  -- Get the base username from metadata or email
  base_username := COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1));
  final_username := base_username;
  
  -- Check for existing username and append number if needed
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    final_username := base_username || counter::text;
    counter := counter + 1;
  END LOOP;
  
  INSERT INTO public.profiles (user_id, username, role)
  VALUES (
    NEW.id,
    final_username,
    COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'user')
  );
  
  RETURN NEW;
END;
$$;