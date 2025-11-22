-- Create discount codes table
CREATE TABLE public.discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed')),
  value DECIMAL(10,2) NOT NULL CHECK (value > 0),
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  valid_to TIMESTAMP WITH TIME ZONE NOT NULL,
  usage_limit INTEGER NULL, -- NULL means unlimited
  used_count INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  stripe_coupon_id TEXT NULL,
  stripe_promo_code_id TEXT NULL,
  applicable_products JSONB NOT NULL DEFAULT '["all"]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage discount codes" 
ON public.discount_codes 
FOR ALL 
USING (is_admin(auth.uid()));

CREATE POLICY "Service role can manage discount codes" 
ON public.discount_codes 
FOR ALL 
USING (true);

-- Create indexes
CREATE INDEX idx_discount_codes_code ON public.discount_codes(code);
CREATE INDEX idx_discount_codes_active ON public.discount_codes(active);
CREATE INDEX idx_discount_codes_dates ON public.discount_codes(valid_from, valid_to);

-- Create trigger for updated_at
CREATE TRIGGER update_discount_codes_updated_at
  BEFORE UPDATE ON public.discount_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create table to track discount code usage
CREATE TABLE public.discount_code_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_code_id UUID NOT NULL REFERENCES public.discount_codes(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  order_amount DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) NOT NULL,
  stripe_session_id TEXT NULL
);

-- Enable RLS for usage tracking
ALTER TABLE public.discount_code_usage ENABLE ROW LEVEL SECURITY;

-- Create policies for usage tracking
CREATE POLICY "Admins can view usage" 
ON public.discount_code_usage 
FOR SELECT 
USING (is_admin(auth.uid()));

CREATE POLICY "Service role can manage usage" 
ON public.discount_code_usage 
FOR ALL 
USING (true);

-- Create indexes for usage tracking
CREATE INDEX idx_discount_usage_code_id ON public.discount_code_usage(discount_code_id);
CREATE INDEX idx_discount_usage_email ON public.discount_code_usage(customer_email);
CREATE INDEX idx_discount_usage_date ON public.discount_code_usage(used_at);