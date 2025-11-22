-- Create email templates table
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  from_email TEXT NOT NULL DEFAULT 'info@buyawarranty.co.uk',
  template_type TEXT NOT NULL, -- 'welcome', 'renewal', 'abandoned_cart', etc.
  content JSONB NOT NULL DEFAULT '{}', -- Will store template variables and content
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create email logs table for tracking
CREATE TABLE public.email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES public.email_templates(id),
  recipient_email TEXT NOT NULL,
  customer_id UUID REFERENCES public.customers(id),
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'bounced'
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create scheduled emails table
CREATE TABLE public.scheduled_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES public.email_templates(id) NOT NULL,
  customer_id UUID REFERENCES public.customers(id),
  recipient_email TEXT NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'sent', 'cancelled'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_emails ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_templates
CREATE POLICY "Admins can manage email templates" 
ON public.email_templates 
FOR ALL 
USING (is_admin(auth.uid()));

CREATE POLICY "Service role can access email templates" 
ON public.email_templates 
FOR ALL 
USING (true);

-- RLS Policies for email_logs
CREATE POLICY "Admins can view email logs" 
ON public.email_logs 
FOR SELECT 
USING (is_admin(auth.uid()));

CREATE POLICY "Service role can manage email logs" 
ON public.email_logs 
FOR ALL 
USING (true);

-- RLS Policies for scheduled_emails
CREATE POLICY "Admins can manage scheduled emails" 
ON public.scheduled_emails 
FOR ALL 
USING (is_admin(auth.uid()));

CREATE POLICY "Service role can manage scheduled emails" 
ON public.scheduled_emails 
FOR ALL 
USING (true);

-- Insert default email templates
INSERT INTO public.email_templates (name, subject, template_type, from_email, content) VALUES
('welcome_email', 'Welcome to Buyawarranty.co.uk – Let''s Get You Started', 'welcome', 'info@buyawarranty.co.uk', 
 '{"greeting": "Hi {{customerFirstName}},", "content": "Welcome to Buyawarranty.co.uk – we''re delighted to have you on board! 🚗\\n\\nYou''re now part of a growing community of smart drivers who value peace of mind on the road. To get the most from your warranty, we recommend registering on your online portal, where you can:\\n✅ View your policy documents\\n✅ Track claims and updates\\n✅ Renew or upgrade your warranty anytime\\n\\n👉 [Click here to sign up now]({{portalUrl}}) – it only takes a minute.\\n\\nIf you have any questions or need help getting started, just hit reply or call us on 0330 229 5040.\\n\\nHappy motoring,\\nThe Customer Care Team\\nBuyawarranty.co.uk"}'),

('renewal_reminder_30', 'Your Warranty Ends Soon – Don''t Risk Driving Unprotected', 'renewal', 'info@buyawarranty.co.uk',
 '{"greeting": "Hi {{customerFirstName}},", "content": "Your vehicle warranty is due to expire on **{{expiryDate}}**, and we''d hate to see you unprotected. Avoid costly repair bills and keep that peace of mind going with a quick renewal.\\n\\nWe''ve made it simple:\\n🔄 Renew online in under 60 seconds\\n🔧 Enjoy continuous protection with no gaps\\n💸 Keep your existing loyalty rate (if eligible)\\n\\n👉 [Click here to renew now]({{renewalUrl}})\\n\\nIf you''d prefer to renew over the phone or discuss your options, give us a ring on 0330 229 5040.\\n\\nAll the best,\\nSales & Customer Support Team\\nBuyawarranty.co.uk\\ninfo@buyawarranty.co.uk"}'),

('renewal_reminder_7', 'URGENT: Your Warranty Expires in 7 Days', 'renewal', 'info@buyawarranty.co.uk',
 '{"greeting": "Hi {{customerFirstName}},", "content": "Your vehicle warranty expires in just **7 days** on {{expiryDate}}. Don''t let your protection lapse!\\n\\n🚨 **Act now to avoid:**\\n• Costly repair bills\\n• Coverage gaps\\n• Higher renewal rates\\n\\n👉 [Renew now in 60 seconds]({{renewalUrl}})\\n\\nQuestions? Call us on 0330 229 5040.\\n\\nUrgent regards,\\nSales Team\\nBuyawarranty.co.uk"}'),

('abandoned_cart', 'Forgot Something? Your Warranty Quote is Waiting 🚗', 'abandoned_cart', 'info@buyawarranty.co.uk',
 '{"greeting": "Hi {{customerFirstName}},", "content": "We noticed you started creating a warranty plan for your vehicle but didn''t quite finish. No worries – your quote is still saved and ready when you are.\\n\\nHere''s what you get with Buyawarranty.co.uk:\\n✔️ Flexible, affordable cover\\n✔️ Quick and easy claims process\\n✔️ UK-based support team\\n✔️ No nasty surprises – just great protection\\n\\n👉 [Resume your quote now]({{quoteUrl}}) – it only takes a minute to complete!\\n\\nNeed help choosing the right plan? Just reply to this email or give us a ring on 0330 229 5040.\\n\\nKind regards,\\nSales & Customer Support Team\\nBuyawarranty.co.uk\\ninfo@buyawarranty.co.uk"}'),

('expiry_followup', 'Your Warranty Has Expired – Act Now to Regain Cover', 'expiry', 'info@buyawarranty.co.uk',
 '{"greeting": "Hi {{customerFirstName}},", "content": "Your vehicle warranty expired on **{{expiryDate}}**, which means you''re currently driving without protection against unexpected repair bills.\\n\\nWe''re here to help you get covered again – quickly and easily:\\n🔧 No vehicle inspection needed (within grace period)\\n💷 Protection from major repair costs\\n📄 Hassle-free claims process\\n\\n👉 [Reinstate your warranty now]({{reinstateUrl}})\\n\\nStill have questions? We''re here to help. Just reply to this email or call us on 0330 229 5040.\\n\\nDrive safe,\\nSales & Customer Support Team\\nBuyawarranty.co.uk\\ninfo@buyawarranty.co.uk"}'),

('sales_inquiry_reply', 'Thanks for Your Interest – Let''s Find the Right Warranty for You', 'sales', 'info@buyawarranty.co.uk',
 '{"greeting": "Hi {{customerFirstName}},", "content": "Thanks for reaching out to Buyawarranty.co.uk! We''d love to help you find the perfect protection for your vehicle.\\n\\nTo get started, please answer the following quick questions:\\n1. Your vehicle registration\\n2. Approximate mileage\\n3. Preferred level of cover (Basic / Standard / Premium)\\n\\nAlternatively, you can get an instant quote right here:\\n👉 [Get a Quote]({{quoteUrl}})\\n\\nFeel free to call us directly on 0330 229 5040 if you''d prefer to chat things through.\\n\\nSpeak soon,\\nSales & Customer Support Team\\nBuyawarranty.co.uk\\ninfo@buyawarranty.co.uk"}'),

('refer_friend', 'Share the Love – Get £20 for Every Friend You Refer 🚘', 'marketing', 'info@buyawarranty.co.uk',
 '{"greeting": "Hi {{customerFirstName}},", "content": "Love your warranty? Your friends will too.\\n\\nRefer a friend to Buyawarranty.co.uk and you''ll both get **£20 off** when they buy a policy. It''s that easy.\\n\\nHere''s how it works:\\n1. Share your unique link: {{referralLink}}\\n2. Your friend gets £20 off their warranty\\n3. You get a £20 amazon voucher 🎉\\n\\nStart referring today → [Refer Now]({{referralLink}})\\n\\nThanks for spreading the word!\\nMarketing Team\\nBuyawarranty.co.uk\\ninfo@buyawarranty.co.uk"}'),

('educational_repair_costs', 'The Average Car Repair Costs £620 – Can You Afford That?', 'educational', 'info@buyawarranty.co.uk',
 '{"greeting": "Hi {{customerFirstName}},", "content": "A recent study showed the average car repair bill in the UK is **£620** – and that''s just for a single issue.\\n\\nWith a Buyawarranty.co.uk plan, you''re protected from the cost of:\\n⚙️ Gearbox repairs (£850+)\\n🔋 Battery and electrics (£450+)\\n🔧 Engine failure (£1,500+)\\n\\nOur plans start from just £{{monthlyPrice}} per month – and could save you thousands.\\n👉 [Get Protected Today]({{quoteUrl}})\\n\\nStill not sure? Check out what our customers have to say → [Read Reviews]({{reviewsUrl}})\\n\\nDrive with confidence,\\nMarketing Team\\nBuyawarranty.co.uk\\ninfo@buyawarranty.co.uk"}'),

('claims_acknowledgement', 'We''ve Received Your Claim – What Happens Next', 'claims', 'claims@buyawarranty.co.uk',
 '{"greeting": "Hi {{customerFirstName}},", "content": "Thanks for submitting your claim regarding your vehicle warranty. We''ve received your request and assigned it to our claims team.\\n\\nHere''s what happens next:\\n1. We''ll review your claim within 1 business day\\n2. We may contact your repairer if we need more information\\n3. You''ll receive an update as soon as a decision is made\\n\\nYou can track the status anytime by logging into your portal here: [Portal Link]({{portalUrl}})\\n\\nIf you have urgent questions, just reply to this email or call us on 0330 229 5045.\\n\\nKind regards,\\nClaims Team\\nBuyawarranty.co.uk\\nclaims@buyawarranty.co.uk"}'),

('claim_form_submitted', 'Your Claim Form Has Been Received – We''re On It', 'claims', 'claims@buyawarranty.co.uk',
 '{"greeting": "Hi {{customerFirstName}},", "content": "Thank you for submitting your claim form. We''ve received your request and one of our claims handlers is now reviewing the details.\\n\\nHere''s what you can expect next:\\n🔍 Assessment: We''ll review your claim thoroughly, including any supporting documents provided.\\n📞 Follow-Up: If we need further information or clarification, we''ll be in touch with you or your repairer directly.\\n📆 Decision: You''ll receive an update within 1 working day of submission.\\n\\nYou can also track the status of your claim at any time by logging into your customer portal here:\\n👉 [Access Your Portal]({{portalUrl}})\\n\\nIf you have any questions in the meantime, feel free to reply to this email or call us on 0330 229 5045.\\n\\nKind regards,\\nClaims Team\\nBuyawarranty.co.uk\\nclaims@buyawarranty.co.uk"}'),

('claim_approved', 'Good News – Your Claim Has Been Approved 🎉', 'claims', 'claims@buyawarranty.co.uk',
 '{"greeting": "Hi {{customerFirstName}},", "content": "We''re pleased to let you know that your claim has been approved under the terms of your warranty policy.\\n\\n✅ Approved Item(s): {{approvedItems}}\\n💷 Covered Amount: £{{coveredAmount}}\\n🔧 Repairer: {{repairerName}}\\n\\nWe''ve already notified your repairer and authorised the work to begin. If there''s anything else you need during the repair process, please don''t hesitate to reach out.\\n\\nThanks for choosing Buyawarranty.co.uk – we''re here to keep you moving with confidence.\\n\\nKind regards,\\nClaims Team\\nBuyawarranty.co.uk\\nclaims@buyawarranty.co.uk"}'),

('claim_more_info', 'Action Required – More Information Needed for Your Claim', 'claims', 'claims@buyawarranty.co.uk',
 '{"greeting": "Hi {{customerFirstName}},", "content": "Thanks for submitting your claim. To complete our assessment, we just need a little more information.\\n\\nPlease provide the following:\\n📄 {{requiredDocuments}}\\n\\nYou can upload these via your portal here:\\n👉 [Upload Documents]({{uploadUrl}})\\nOr reply to this email with the required files attached.\\n\\nOnce received, we''ll continue processing your claim right away and aim to provide a decision within 1 working day.\\n\\nIf you have any questions, we''re here to help.\\n\\nKind regards,\\nClaims Team\\nBuyawarranty.co.uk\\nclaims@buyawarranty.co.uk"}'),

('claim_declined', 'Update Regarding Your Claim – Outcome Attached', 'claims', 'claims@buyawarranty.co.uk',
 '{"greeting": "Hi {{customerFirstName}},", "content": "Thank you for your patience while we reviewed your claim. Unfortunately, we''re unable to approve your claim on this occasion.\\n\\nReason for Decline:\\n{{declineReason}}\\n\\nWe''ve attached a detailed claims outcome letter for your reference.\\n\\nWe understand this may be disappointing, and if you''d like to discuss the decision or believe we may have missed something, please don''t hesitate to reply or call us on 0330 229 5045.\\n\\nKind regards,\\nClaims Team\\nBuyawarranty.co.uk\\nclaims@buyawarranty.co.uk"}'),

('complaint_acknowledgement', 'We''ve Received Your Complaint – We''re Looking Into It', 'complaint', 'claims@buyawarranty.co.uk',
 '{"greeting": "Hi {{customerFirstName}},", "content": "Thank you for getting in touch. We''re sorry to hear you''ve had a negative experience and appreciate the opportunity to put things right.\\n\\nWe''ve logged your complaint and assigned it to a senior member of our team for investigation. You can expect an initial response within {{responseTime}} working days.\\n\\nIn the meantime, if you have any further details you''d like to add, please reply to this email.\\n\\nKind regards,\\nComplaints Resolution Team\\nBuyawarranty.co.uk\\nclaims@buyawarranty.co.uk"}'),

('winter_campaign', 'Is Your Car Ready for Winter? ❄️ Save 20% on Warranty Cover', 'seasonal', 'info@buyawarranty.co.uk',
 '{"greeting": "Hi {{customerFirstName}},", "content": "Colder days mean tougher driving conditions – and a higher risk of unexpected breakdowns. Make sure you''re protected this winter with a vehicle warranty from Buyawarranty.co.uk.\\n\\n🧰 24/7 cover for mechanical and electrical breakdowns\\n🚗 Use any VAT-registered garage nationwide\\n💷 Up to £5,000 per claim (depending on your plan)\\n\\n**Get 20% off now** with code: **WINTER20**\\n👉 [Get My Quote]({{quoteUrl}})\\n\\nOffer valid until {{offerEndDate}} – stay safe and covered this winter!\\n\\nWarm regards,\\nMarketing Team\\nBuyawarranty.co.uk\\ninfo@buyawarranty.co.uk"}');

-- Create indexes for better performance
CREATE INDEX idx_email_logs_recipient ON public.email_logs(recipient_email);
CREATE INDEX idx_email_logs_status ON public.email_logs(status);
CREATE INDEX idx_email_logs_created_at ON public.email_logs(created_at);
CREATE INDEX idx_scheduled_emails_scheduled_for ON public.scheduled_emails(scheduled_for);
CREATE INDEX idx_scheduled_emails_status ON public.scheduled_emails(status);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_email_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_email_template_updated_at();