-- Add contact status and notes to abandoned_carts table
ALTER TABLE public.abandoned_carts 
ADD COLUMN contact_status text DEFAULT 'not_contacted',
ADD COLUMN contact_notes text,
ADD COLUMN last_contacted_at timestamp with time zone,
ADD COLUMN contacted_by uuid REFERENCES auth.users(id);