
ALTER TABLE public.live_quotes ADD COLUMN IF NOT EXISTS customer_dob DATE NULL;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS customer_dob DATE NULL;
