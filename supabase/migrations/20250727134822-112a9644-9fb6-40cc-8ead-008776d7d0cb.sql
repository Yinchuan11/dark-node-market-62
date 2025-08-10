-- Create a table to track online users
CREATE TABLE IF NOT EXISTS public.user_presence (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  username text NOT NULL,
  last_seen timestamp with time zone NOT NULL DEFAULT now(),
  is_online boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- Create policies for user presence
CREATE POLICY "Anyone can view online users" 
ON public.user_presence 
FOR SELECT 
USING (true);

CREATE POLICY "Users can update their own presence" 
ON public.user_presence 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own presence status" 
ON public.user_presence 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_presence_updated_at
BEFORE UPDATE ON public.user_presence
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for user_presence table
ALTER TABLE public.user_presence REPLICA IDENTITY FULL;

-- Insert 122 online users from existing profiles
INSERT INTO public.user_presence (user_id, username, is_online, last_seen)
SELECT 
    p.user_id,
    p.username,
    true,
    now() - (random() * interval '10 minutes')
FROM profiles p
ORDER BY random()
LIMIT 122
ON CONFLICT (user_id) DO UPDATE SET
    is_online = true,
    last_seen = now() - (random() * interval '10 minutes'),
    updated_at = now();