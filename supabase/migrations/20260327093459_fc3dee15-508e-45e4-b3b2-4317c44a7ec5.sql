
-- Add is_public flag to discount_codes for the public promo page
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS public_description text;

-- Create an RLS policy allowing anonymous read of public discount codes
CREATE POLICY "Anyone can view public active discount codes"
ON public.discount_codes
FOR SELECT
TO anon, authenticated
USING (active = true AND archived = false AND is_public = true AND valid_to > now());
