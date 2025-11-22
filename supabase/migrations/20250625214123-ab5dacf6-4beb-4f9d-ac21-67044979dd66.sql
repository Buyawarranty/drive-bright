
-- Create customers table to store user data and plan information
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('Basic', 'Gold', 'Platinum')),
  signup_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  voluntary_excess DECIMAL(10,2),
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Cancelled')),
  stripe_customer_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create admin notes table for private customer notes
CREATE TABLE public.admin_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create plans table for pricing management
CREATE TABLE public.plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  monthly_price DECIMAL(10,2) NOT NULL,
  coverage JSONB NOT NULL DEFAULT '[]',
  add_ons JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user roles table for admin access
CREATE TYPE public.user_role AS ENUM ('admin', 'customer');

CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'customer',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create payments table for analytics
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP',
  stripe_payment_id TEXT,
  payment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  plan_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default plans
INSERT INTO public.plans (name, monthly_price, coverage, add_ons) VALUES
('Basic', 9.99, '["Breakdown cover", "Recovery to nearest garage", "24/7 helpline"]', '["Home start: £2.99", "European cover: £4.99"]'),
('Gold', 19.99, '["Everything in Basic", "Onward travel", "Overnight accommodation", "Alternative transport"]', '["Key cover: £3.99", "Personal accident: £5.99"]'),
('Platinum', 29.99, '["Everything in Gold", "At-home repairs", "Recovery to destination", "Vehicle health check"]', '["Motor legal protection: £7.99", "Protected no claims: £9.99"]');

-- Enable RLS on all tables
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check admin role
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  );
$$;

-- RLS policies for admin access
CREATE POLICY "Admins can manage customers"
  ON public.customers
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage notes"
  ON public.admin_notes
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Everyone can read plans"
  ON public.plans
  FOR SELECT
  TO public
  USING (is_active = true);

CREATE POLICY "Admins can manage plans"
  ON public.plans
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view their own roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage payments"
  ON public.payments
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));
