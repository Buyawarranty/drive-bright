-- Create table for tracking emails sent related to abandoned carts
CREATE TABLE public.abandoned_cart_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  abandoned_cart_id UUID REFERENCES public.abandoned_carts(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  email_type TEXT NOT NULL CHECK (email_type IN ('customer_quote', 'admin_followup')),
  subject TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_by UUID,
  vehicle_reg TEXT,
  plan_name TEXT,
  price_amount NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.abandoned_cart_emails ENABLE ROW LEVEL SECURITY;

-- Admins can view and manage
CREATE POLICY "Admins can manage abandoned cart emails"
ON public.abandoned_cart_emails
FOR ALL
USING (is_admin(auth.uid()));

-- Service role can manage
CREATE POLICY "Service role can manage abandoned cart emails"
ON public.abandoned_cart_emails
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_abandoned_cart_emails_cart_id ON public.abandoned_cart_emails(abandoned_cart_id);
CREATE INDEX idx_abandoned_cart_emails_customer_email ON public.abandoned_cart_emails(customer_email);