-- Enable RLS on special_vehicle_plans if not already enabled
ALTER TABLE public.special_vehicle_plans ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to read active plans (public data)
CREATE POLICY "Anyone can view active vehicle plans" 
ON public.special_vehicle_plans 
FOR SELECT 
USING (is_active = true);

-- Also ensure the plans table has public read access
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans" 
ON public.plans 
FOR SELECT 
USING (is_active = true);