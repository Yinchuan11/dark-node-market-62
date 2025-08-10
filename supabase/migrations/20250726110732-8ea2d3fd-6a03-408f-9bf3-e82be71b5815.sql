-- Update the status check constraint to include 'completed' status
ALTER TABLE public.transactions DROP CONSTRAINT transactions_status_check;

ALTER TABLE public.transactions ADD CONSTRAINT transactions_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'failed'::text, 'completed'::text]));