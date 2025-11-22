-- Create referrals table to track referral system
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_email TEXT NOT NULL,
  referrer_name TEXT,
  friend_email TEXT NOT NULL,
  discount_code TEXT,
  discount_code_id UUID REFERENCES public.discount_codes(id),
  status TEXT NOT NULL DEFAULT 'sent',
  converted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Admin can view all referrals
CREATE POLICY "Admins can view all referrals"
ON public.referrals
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- Service role can manage referrals
CREATE POLICY "Service role can manage referrals"
ON public.referrals
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Add referral tracking to discount_codes table
ALTER TABLE public.discount_codes 
ADD COLUMN IF NOT EXISTS is_referral_code BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS referrer_email TEXT;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_email ON public.referrals(referrer_email);
CREATE INDEX IF NOT EXISTS idx_referrals_friend_email ON public.referrals(friend_email);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);