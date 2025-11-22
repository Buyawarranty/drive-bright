-- Create the update_updated_at_column function first
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create abandoned cart table to track potential customers
CREATE TABLE public.abandoned_carts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  vehicle_reg TEXT,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_year TEXT,
  mileage TEXT,
  plan_id UUID,
  plan_name TEXT,
  payment_type TEXT,
  step_abandoned INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.abandoned_carts ENABLE ROW LEVEL SECURITY;

-- Create policies for abandoned cart data
CREATE POLICY "Service role can manage abandoned carts" 
ON public.abandoned_carts 
FOR ALL 
USING (true);

CREATE POLICY "Admins can view abandoned carts" 
ON public.abandoned_carts 
FOR SELECT 
USING (is_admin(auth.uid()));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_abandoned_carts_updated_at
BEFORE UPDATE ON public.abandoned_carts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();