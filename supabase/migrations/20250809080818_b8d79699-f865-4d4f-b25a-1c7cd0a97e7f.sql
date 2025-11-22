-- Create comprehensive policy management system for live warranty purchasing

-- First, let's check and update the customer_policies table to include all required fields
ALTER TABLE public.customer_policies ADD COLUMN IF NOT EXISTS warranty_number TEXT;
ALTER TABLE public.customer_policies ADD COLUMN IF NOT EXISTS pdf_document_path TEXT;
ALTER TABLE public.customer_policies ADD COLUMN IF NOT EXISTS email_sent_status TEXT DEFAULT 'not_sent';
ALTER TABLE public.customer_policies ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;
ALTER TABLE public.customer_policies ADD COLUMN IF NOT EXISTS warranties_2000_status TEXT DEFAULT 'not_sent';
ALTER TABLE public.customer_policies ADD COLUMN IF NOT EXISTS warranties_2000_sent_at TIMESTAMPTZ;
ALTER TABLE public.customer_policies ADD COLUMN IF NOT EXISTS warranties_2000_response JSONB;
ALTER TABLE public.customer_policies ADD COLUMN IF NOT EXISTS bumper_order_id TEXT;
ALTER TABLE public.customer_policies ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;
ALTER TABLE public.customer_policies ADD COLUMN IF NOT EXISTS payment_amount NUMERIC;
ALTER TABLE public.customer_policies ADD COLUMN IF NOT EXISTS payment_currency TEXT DEFAULT 'GBP';
ALTER TABLE public.customer_policies ADD COLUMN IF NOT EXISTS customer_full_name TEXT;
ALTER TABLE public.customer_policies ADD COLUMN IF NOT EXISTS document_type TEXT; -- 'standard' or 'special_vehicle'

-- Update customers table to include warranty number if not exists
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS warranty_number TEXT;

-- Create an index on warranty_number for fast lookups
CREATE INDEX IF NOT EXISTS idx_customer_policies_warranty_number ON public.customer_policies(warranty_number);
CREATE INDEX IF NOT EXISTS idx_customer_policies_email_status ON public.customer_policies(email_sent_status);
CREATE INDEX IF NOT EXISTS idx_customer_policies_warranties_2000_status ON public.customer_policies(warranties_2000_status);

-- Create a function to generate warranty numbers that are unique and sequential
CREATE OR REPLACE FUNCTION public.generate_warranty_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    warranty_serial INTEGER;
    warranty_number TEXT;
BEGIN
    -- Get the next warranty serial number
    warranty_serial := public.get_next_warranty_serial();
    
    -- Format as BAW-XXXXXX
    warranty_number := 'BAW-' || LPAD(warranty_serial::TEXT, 6, '0');
    
    RETURN warranty_number;
END;
$$;

-- Update the customer_policies table to auto-generate warranty numbers on insert
CREATE OR REPLACE FUNCTION public.set_warranty_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only set warranty number if it's not already provided
    IF NEW.warranty_number IS NULL THEN
        NEW.warranty_number := public.generate_warranty_number();
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger to auto-generate warranty numbers
DROP TRIGGER IF EXISTS trigger_set_warranty_number ON public.customer_policies;
CREATE TRIGGER trigger_set_warranty_number
    BEFORE INSERT ON public.customer_policies
    FOR EACH ROW
    EXECUTE FUNCTION public.set_warranty_number();

-- Create a comprehensive audit log table for all warranty-related events
CREATE TABLE IF NOT EXISTS public.warranty_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID REFERENCES public.customer_policies(id),
    customer_id UUID REFERENCES public.customers(id),
    event_type TEXT NOT NULL, -- 'payment_received', 'email_sent', 'email_failed', 'warranty_2000_sent', etc.
    event_data JSONB,
    event_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by TEXT -- 'system', 'admin', 'webhook'
);

-- Enable RLS on warranty_audit_log
ALTER TABLE public.warranty_audit_log ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to view audit logs
CREATE POLICY "Admins can view warranty audit logs" ON public.warranty_audit_log
FOR SELECT
USING (is_admin(auth.uid()));

-- Create policy for service role to insert audit logs
CREATE POLICY "Service role can insert warranty audit logs" ON public.warranty_audit_log
FOR INSERT
WITH CHECK (true);

-- Function to log warranty events
CREATE OR REPLACE FUNCTION public.log_warranty_event(
    p_policy_id UUID,
    p_customer_id UUID,
    p_event_type TEXT,
    p_event_data JSONB DEFAULT '{}',
    p_created_by TEXT DEFAULT 'system'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO public.warranty_audit_log (
        policy_id,
        customer_id,
        event_type,
        event_data,
        created_by
    ) VALUES (
        p_policy_id,
        p_customer_id,
        p_event_type,
        p_event_data,
        p_created_by
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$;

-- Update the email_templates table to ensure we have a default welcome template
INSERT INTO public.email_templates (
    name,
    subject,
    content,
    template_type,
    is_active,
    from_email
) VALUES (
    'Welcome Email - Default',
    'Welcome — Your Warranty {{warranty_number}}',
    '{
        "greeting": "Dear {{customer_name}},",
        "content": "Congratulations! Your vehicle warranty has been successfully purchased and is now active.\\n\\nYour warranty details:\\n**Warranty Number:** {{warranty_number}}\\n**Policy Start:** {{policy_start_date}}\\n**Policy End:** {{policy_end_date}}\\n\\nYour complete policy documents are attached to this email. You can also download them securely using the link below:\\n\\n[Download Policy Documents]({{secure_download_link}})\\n\\nIf you have any questions about your warranty coverage, please don''t hesitate to contact our customer support team.\\n\\nThank you for choosing buyawarranty.co.uk for your vehicle protection needs."
    }',
    'welcome',
    true,
    'info@buyawarranty.co.uk'
) ON CONFLICT (name) DO UPDATE SET
    subject = EXCLUDED.subject,
    content = EXCLUDED.content,
    updated_at = now();

-- Create a mapping table for plan to document mapping
CREATE TABLE IF NOT EXISTS public.plan_document_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_name TEXT NOT NULL,
    vehicle_type TEXT NOT NULL, -- 'standard' or 'special_vehicle'
    document_path TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(plan_name, vehicle_type)
);

-- Enable RLS on plan_document_mapping
ALTER TABLE public.plan_document_mapping ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to manage plan document mapping
CREATE POLICY "Admins can manage plan document mapping" ON public.plan_document_mapping
FOR ALL
USING (is_admin(auth.uid()));

-- Create policy for service role to read plan document mapping
CREATE POLICY "Service role can read plan document mapping" ON public.plan_document_mapping
FOR SELECT
USING (true);

-- Insert default document mappings (these will need to be updated with actual paths)
INSERT INTO public.plan_document_mapping (plan_name, vehicle_type, document_path) VALUES
('Basic', 'standard', '/documents/standard/basic-policy.pdf'),
('Premium', 'standard', '/documents/standard/premium-policy.pdf'),
('Platinum', 'standard', '/documents/standard/platinum-policy.pdf'),
('Motorcycle Basic', 'special_vehicle', '/documents/special_vehicle/motorcycle-basic.pdf'),
('Motorcycle Premium', 'special_vehicle', '/documents/special_vehicle/motorcycle-premium.pdf'),
('Van Basic', 'special_vehicle', '/documents/special_vehicle/van-basic.pdf'),
('Van Premium', 'special_vehicle', '/documents/special_vehicle/van-premium.pdf')
ON CONFLICT (plan_name, vehicle_type) DO NOTHING;