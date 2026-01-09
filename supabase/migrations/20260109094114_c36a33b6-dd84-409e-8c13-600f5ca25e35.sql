-- Create live_quotes table for customer-facing quote pages
CREATE TABLE public.live_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Customer information
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  
  -- Vehicle information
  vehicle_reg TEXT NOT NULL,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_year TEXT,
  vehicle_mileage TEXT,
  vehicle_fuel_type TEXT,
  vehicle_transmission TEXT,
  vehicle_type TEXT,
  
  -- Cover details
  plan_type TEXT NOT NULL DEFAULT 'Platinum',
  duration_months INTEGER NOT NULL DEFAULT 12,
  bonus_months INTEGER NOT NULL DEFAULT 3,
  excess_amount INTEGER NOT NULL DEFAULT 100,
  claim_limit INTEGER NOT NULL DEFAULT 1250,
  labour_rate INTEGER DEFAULT 70,
  boost_addon BOOLEAN DEFAULT FALSE,
  
  -- Pricing
  monthly_price NUMERIC(10,2) NOT NULL,
  upfront_price NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'GBP',
  
  -- Add-ons (auto-included based on duration)
  breakdown_included BOOLEAN DEFAULT FALSE,
  rental_included BOOLEAN DEFAULT FALSE,
  
  -- Additional notes for Warranties 2000
  additional_notes TEXT,
  
  -- Authentication token (JWT or UUID for link security)
  access_token TEXT NOT NULL UNIQUE,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('draft', 'sent', 'viewed', 'paid', 'expired', 'cancelled')),
  viewed_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  payment_method TEXT, -- 'stripe' or 'bumper'
  payment_reference TEXT, -- stripe session id or bumper transaction id
  
  -- Policy creation tracking
  policy_id UUID,
  policy_number TEXT,
  
  -- Agent/admin tracking
  created_by UUID REFERENCES auth.users(id),
  created_by_name TEXT,
  
  -- Timestamps and expiry
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  
  -- Share links
  share_link TEXT
);

-- Enable RLS
ALTER TABLE public.live_quotes ENABLE ROW LEVEL SECURITY;

-- Policy for admin users to manage quotes
CREATE POLICY "Admin users can manage live quotes"
ON public.live_quotes
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
    AND admin_users.is_active = true
  )
);

-- Policy for public access via access_token (for customer viewing)
CREATE POLICY "Public can view quotes with valid token"
ON public.live_quotes
FOR SELECT
USING (true);

-- Update trigger for updated_at
CREATE TRIGGER update_live_quotes_updated_at
  BEFORE UPDATE ON public.live_quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for token lookups
CREATE INDEX idx_live_quotes_access_token ON public.live_quotes(access_token);

-- Index for status and expiry queries
CREATE INDEX idx_live_quotes_status_expires ON public.live_quotes(status, expires_at);

-- Index for created_by queries
CREATE INDEX idx_live_quotes_created_by ON public.live_quotes(created_by);