
ALTER TABLE public.complaints
ADD COLUMN IF NOT EXISTS preferred_contact_method TEXT;
