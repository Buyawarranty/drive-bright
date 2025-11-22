
-- Create customer_policies table to track customer policies and PDFs
CREATE TABLE public.customer_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('basic', 'gold', 'platinum')),
  payment_type TEXT NOT NULL CHECK (payment_type IN ('monthly', 'yearly', 'twoYear', 'threeYear')),
  policy_number TEXT NOT NULL UNIQUE,
  policy_start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  policy_end_date TIMESTAMPTZ NOT NULL,
  stripe_subscription_id TEXT,
  pdf_basic_url TEXT,
  pdf_gold_url TEXT,
  pdf_platinum_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  address JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create customer_documents table for PDF management
CREATE TABLE public.customer_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_type TEXT NOT NULL CHECK (plan_type IN ('basic', 'gold', 'platinum')),
  document_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create welcome_emails table to track sent welcome emails
CREATE TABLE public.welcome_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  policy_id UUID REFERENCES public.customer_policies(id) ON DELETE CASCADE,
  temporary_password TEXT NOT NULL,
  email_sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  password_reset BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.customer_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.welcome_emails ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customer_policies
CREATE POLICY "Users can view their own policies" 
  ON public.customer_policies 
  FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own policies" 
  ON public.customer_policies 
  FOR UPDATE 
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all policies" 
  ON public.customer_policies 
  FOR ALL 
  USING (true);

-- RLS Policies for customer_documents (admin only for insert/update/delete)
CREATE POLICY "Anyone can view documents" 
  ON public.customer_documents 
  FOR SELECT 
  USING (true);

CREATE POLICY "Service role can manage documents" 
  ON public.customer_documents 
  FOR ALL 
  USING (true);

-- RLS Policies for welcome_emails (service role only)
CREATE POLICY "Service role can manage welcome emails" 
  ON public.welcome_emails 
  FOR ALL 
  USING (true);

-- Function to generate policy number
CREATE OR REPLACE FUNCTION generate_policy_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'POL-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to calculate policy end date based on payment type
CREATE OR REPLACE FUNCTION calculate_policy_end_date(payment_type TEXT, start_date TIMESTAMPTZ)
RETURNS TIMESTAMPTZ AS $$
BEGIN
  CASE payment_type
    WHEN 'monthly' THEN RETURN start_date + INTERVAL '1 month';
    WHEN 'yearly' THEN RETURN start_date + INTERVAL '1 year';
    WHEN 'twoYear' THEN RETURN start_date + INTERVAL '2 years';
    WHEN 'threeYear' THEN RETURN start_date + INTERVAL '3 years';
    ELSE RETURN start_date + INTERVAL '1 month';
  END CASE;
END;
$$ LANGUAGE plpgsql;
