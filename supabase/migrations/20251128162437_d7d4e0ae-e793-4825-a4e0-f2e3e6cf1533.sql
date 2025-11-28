-- Create admin_sent_quotes table to track all quotes sent from admin dashboard
CREATE TABLE IF NOT EXISTS public.admin_sent_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_reference TEXT NOT NULL UNIQUE DEFAULT 'QTE-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0'),
  
  -- Customer information
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  
  -- Vehicle information
  vehicle_reg TEXT NOT NULL,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_year TEXT,
  vehicle_mileage TEXT,
  vehicle_fuel_type TEXT,
  vehicle_transmission TEXT,
  vehicle_type TEXT,
  
  -- Quote details
  plan_name TEXT NOT NULL DEFAULT 'Platinum',
  payment_type TEXT NOT NULL,
  excess_amount INTEGER NOT NULL,
  claim_limit INTEGER NOT NULL,
  total_price NUMERIC(10,2) NOT NULL,
  monthly_price NUMERIC(10,2),
  
  -- Email details
  email_subject TEXT NOT NULL,
  email_content TEXT NOT NULL,
  
  -- Tracking
  sent_by UUID REFERENCES auth.users(id),
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  resent_count INTEGER DEFAULT 0,
  last_resent_at TIMESTAMP WITH TIME ZONE,
  
  -- Status tracking
  customer_responded BOOLEAN DEFAULT FALSE,
  customer_purchased BOOLEAN DEFAULT FALSE,
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE public.admin_sent_quotes ENABLE ROW LEVEL SECURITY;

-- Admin users can view all sent quotes
CREATE POLICY "Admin users can view sent quotes"
  ON public.admin_sent_quotes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'member', 'viewer')
    )
  );

-- Admin users can insert sent quotes
CREATE POLICY "Admin users can insert sent quotes"
  ON public.admin_sent_quotes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  );

-- Admin users can update sent quotes
CREATE POLICY "Admin users can update sent quotes"
  ON public.admin_sent_quotes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  );

-- Create index for faster queries
CREATE INDEX idx_admin_sent_quotes_email ON public.admin_sent_quotes(customer_email);
CREATE INDEX idx_admin_sent_quotes_vehicle_reg ON public.admin_sent_quotes(vehicle_reg);
CREATE INDEX idx_admin_sent_quotes_sent_at ON public.admin_sent_quotes(sent_at DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_admin_sent_quotes_updated_at
  BEFORE UPDATE ON public.admin_sent_quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();