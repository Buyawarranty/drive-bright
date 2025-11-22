-- Create table for storing MOT history data
CREATE TABLE public.mot_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  registration TEXT NOT NULL,
  customer_id UUID,
  make TEXT,
  model TEXT,
  primary_colour TEXT,
  fuel_type TEXT,
  mot_tests JSONB NOT NULL DEFAULT '[]'::jsonb,
  dvla_id TEXT,
  registration_date DATE,
  manufacture_date DATE,
  engine_capacity INTEGER,
  co2_emissions INTEGER,
  euro_status TEXT,
  real_driving_emissions TEXT,
  marked_for_export BOOLEAN DEFAULT false,
  colour TEXT,
  type_approval TEXT,
  wheelplan TEXT,
  revenue_weight INTEGER,
  date_of_last_v5c_issued DATE,
  mot_expiry_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mot_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage MOT history" 
ON public.mot_history 
FOR ALL 
USING (is_admin(auth.uid()));

CREATE POLICY "Service role can manage MOT history" 
ON public.mot_history 
FOR ALL 
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_mot_history_registration ON public.mot_history(registration);
CREATE INDEX idx_mot_history_customer_id ON public.mot_history(customer_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_mot_history_updated_at
BEFORE UPDATE ON public.mot_history
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();