-- Create email templates table for abandoned cart emails
CREATE TABLE IF NOT EXISTS public.abandoned_cart_email_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trigger_type VARCHAR(50) NOT NULL, -- 'pricing_page_view' or 'plan_selected'
  name VARCHAR(100) NOT NULL,
  subject VARCHAR(200) NOT NULL,
  html_content TEXT NOT NULL,
  text_content TEXT,
  is_active BOOLEAN DEFAULT true,
  send_delay_minutes INTEGER DEFAULT 60, -- how long to wait before sending
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create triggered emails log table to track what emails have been sent
CREATE TABLE IF NOT EXISTS public.triggered_emails_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  trigger_type VARCHAR(50) NOT NULL,
  template_id UUID REFERENCES public.abandoned_cart_email_templates(id),
  vehicle_reg VARCHAR(20),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  email_status VARCHAR(20) DEFAULT 'sent', -- 'sent', 'failed', 'bounced'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.abandoned_cart_email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.triggered_emails_log ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access only
CREATE POLICY "Admins can manage email templates" ON public.abandoned_cart_email_templates
FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can view triggered emails log" ON public.triggered_emails_log
FOR SELECT USING (public.is_admin(auth.uid()));

-- Allow edge functions to insert/update
CREATE POLICY "Edge functions can insert triggered emails log" ON public.triggered_emails_log
FOR INSERT WITH CHECK (true);

-- Insert default email templates
INSERT INTO public.abandoned_cart_email_templates (trigger_type, name, subject, html_content, text_content, send_delay_minutes) VALUES
('pricing_page_view', 'Pricing Page Abandoned', 'Still considering your warranty options?', '
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Complete Your Warranty Quote</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 30px;">
        <h1 style="color: #1a365d; margin-bottom: 20px;">Still considering your warranty options?</h1>
        <p>Hi {{firstName}},</p>
        <p>We noticed you were looking at warranty options for your <strong>{{vehicleMake}} {{vehicleModel}} ({{vehicleReg}})</strong> but didn''t select a plan.</p>
        <p>We''re here to help! Our warranty plans provide comprehensive coverage and peace of mind for your vehicle.</p>
        
        <div style="background: white; padding: 25px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #1a365d;">
            <h3 style="margin-top: 0; color: #1a365d;">Need help choosing the right plan?</h3>
            <ul style="margin: 15px 0;">
                <li>Compare our Basic, Gold, and Platinum options</li>
                <li>Customize your voluntary excess</li>
                <li>See exactly what''s covered</li>
            </ul>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{continueUrl}}" style="background: #1a365d; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Choose Your Plan</a>
        </div>
        
        <p style="color: #666; font-size: 14px;">Questions? Reply to this email or call us at 0800 123 4567</p>
    </div>
</body>
</html>
', 'Hi {{firstName}}, We noticed you were looking at warranty options for your {{vehicleMake}} {{vehicleModel}} ({{vehicleReg}}) but didn''t select a plan. Continue your quote: {{continueUrl}}', 60),

('plan_selected', 'Plan Selected But Not Completed', 'Complete your warranty purchase - {{planName}} plan waiting for you', '
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Complete Your Warranty Purchase</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 30px;">
        <h1 style="color: #1a365d; margin-bottom: 20px;">Your {{planName}} warranty is waiting for you!</h1>
        <p>Hi {{firstName}},</p>
        <p>You''re just one step away from securing comprehensive warranty coverage for your <strong>{{vehicleMake}} {{vehicleModel}} ({{vehicleReg}})</strong>.</p>
        
        <div style="background: white; padding: 25px; border-radius: 8px; margin: 25px 0; border: 2px solid #ffd700;">
            <h3 style="margin-top: 0; color: #1a365d;">Your Selected Plan:</h3>
            <div style="background: #ffd700; color: #1a365d; padding: 15px; border-radius: 6px; text-align: center; font-weight: bold; font-size: 18px;">
                {{planName}} Warranty - {{paymentType}}
            </div>
            <p style="margin: 15px 0 0 0; text-align: center; font-size: 16px;">
                <strong>Save a further 5%</strong> when you pay the full amount upfront!
            </p>
        </div>
        
        <div style="background: #e8f4f8; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <h4 style="margin-top: 0; color: #1a365d;">Why choose us?</h4>
            <ul style="margin: 0; padding-left: 20px;">
                <li>Comprehensive breakdown coverage</li>
                <li>UK-wide recovery service</li>
                <li>12 months interest-free payments</li>
                <li>24/7 customer support</li>
            </ul>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{checkoutUrl}}" style="background: #ffd700; color: #1a365d; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 18px;">Complete Your Purchase</a>
        </div>
        
        <p style="color: #666; font-size: 14px; text-align: center;">Secure payment • Free to cancel within 14 days</p>
        <p style="color: #666; font-size: 14px;">Questions? Reply to this email or call us at 0800 123 4567</p>
    </div>
</body>
</html>
', 'Hi {{firstName}}, Your {{planName}} warranty for {{vehicleMake}} {{vehicleModel}} ({{vehicleReg}}) is waiting! Complete your purchase: {{checkoutUrl}}', 30);

-- Create trigger for updated_at
CREATE TRIGGER update_abandoned_cart_email_templates_updated_at
    BEFORE UPDATE ON public.abandoned_cart_email_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();