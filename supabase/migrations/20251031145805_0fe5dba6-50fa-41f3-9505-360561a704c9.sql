-- Insert Trustpilot review request email template
INSERT INTO public.email_templates (
  name, 
  subject, 
  template_type, 
  from_email, 
  content,
  is_active
) VALUES (
  'trustpilot_review_request',
  'Thank you for choosing BuyAWarranty.co.uk!',
  'review_request',
  'info@buyawarranty.co.uk',
  '{
    "greeting": "Hi {{customerFirstName}},",
    "body": "We''re thrilled you''ve secured reliable protection with your new vehicle warranty. Your feedback helps us improve and helps other drivers make the right choice.\n\nLeaving a review takes less than 60 seconds and means the world to us. Plus, your opinion helps others find the best protection for their vehicles.",
    "cta_text": "Leave Your Review on Trustpilot",
    "cta_url": "https://uk.trustpilot.com/review/buyawarranty.co.uk",
    "footer": "Your peace of mind is our priority—thank you for choosing BuyAWarranty.co.uk!\n\nThe BuyAWarranty.co.uk Team"
  }'::jsonb,
  true
) ON CONFLICT (name) DO UPDATE SET
  subject = EXCLUDED.subject,
  content = EXCLUDED.content,
  updated_at = now();

-- Create a table to track Trustpilot review emails sent to avoid duplicates
CREATE TABLE IF NOT EXISTS public.trustpilot_review_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_id UUID NOT NULL REFERENCES public.customer_policies(id),
  customer_id UUID REFERENCES public.customers(id),
  email TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  email_log_id UUID REFERENCES public.email_logs(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trustpilot_review_emails ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view trustpilot review emails" 
ON public.trustpilot_review_emails 
FOR SELECT 
USING (is_admin(auth.uid()));

CREATE POLICY "Service role can manage trustpilot review emails" 
ON public.trustpilot_review_emails 
FOR ALL 
USING (true);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_trustpilot_review_emails_policy_id ON public.trustpilot_review_emails(policy_id);
CREATE INDEX IF NOT EXISTS idx_trustpilot_review_emails_sent_at ON public.trustpilot_review_emails(sent_at);