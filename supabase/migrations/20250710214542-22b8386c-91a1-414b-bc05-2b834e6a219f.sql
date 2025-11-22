
-- Create table for special vehicle type plans (EV, PHEV, Motorbike)
CREATE TABLE public.special_vehicle_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('EV', 'PHEV', 'MOTORBIKE')),
  name TEXT NOT NULL,
  monthly_price NUMERIC NOT NULL,
  yearly_price NUMERIC,
  two_yearly_price NUMERIC,
  three_yearly_price NUMERIC,
  coverage JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(vehicle_type)
);

-- Enable RLS
ALTER TABLE public.special_vehicle_plans ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read active plans
CREATE POLICY "Everyone can read active special vehicle plans"
  ON public.special_vehicle_plans
  FOR SELECT
  USING (is_active = true);

-- Allow admins to manage special vehicle plans
CREATE POLICY "Admins can manage special vehicle plans"
  ON public.special_vehicle_plans
  FOR ALL
  USING (is_admin(auth.uid()));

-- Add PDF document columns for special vehicle types
ALTER TABLE public.customer_documents 
ADD COLUMN vehicle_type TEXT CHECK (vehicle_type IN ('standard', 'EV', 'PHEV', 'MOTORBIKE')) DEFAULT 'standard';

-- Insert default data for special vehicle plans
INSERT INTO public.special_vehicle_plans (vehicle_type, name, monthly_price, yearly_price, two_yearly_price, three_yearly_price, coverage) VALUES
('EV', 'Electric Vehicle EV Extended Warranty', 34, 409, 777, 1125, '[
  "Mechanical & Electrical",
  "Labour up to £75 p/hr", 
  "Unlimited Claims",
  "14-Day Risk-Free Cancellation",
  "Halfords MOT test",
  "Vehicle age up to 15 years",
  "Mileage up to 150k miles",
  "Motor(s)",
  "Motor Power Supply", 
  "Motor Control",
  "Battery System",
  "Ancillary Electrics",
  "Steering",
  "Braking System",
  "Suspension",
  "Battery / Motor Cooling System",
  "Climate Control / Heating",
  "Locks",
  "Battery Cell Replacement"
]'::jsonb),
('PHEV', 'PHEV Hybrid Extended Warranty', 34, 409, 777, 1125, '[
  "Mechanical & Electrical",
  "Labour upto £75 p/hr",
  "Unlimited Claims",
  "14-Day Risk-Free Cancellation",
  "Halfords MOT test",
  "Vehicle age up to 15 years",
  "Mileage up to 150k miles",
  "Engine",
  "Transmission",
  "Final Drive",
  "Fuel System",
  "Motor(s)",
  "Motor Power Supply",
  "Motor Control",
  "Battery System",
  "Ancillary Electrics",
  "Steering",
  "Braking System",
  "Suspension",
  "Battery/Motor Cooling System",
  "Climate Control / Heating",
  "Locks"
]'::jsonb),
('MOTORBIKE', 'Motorbike Extended Warranty', 34, 409, 777, 1125, '[
  "Mechanical & Electrical",
  "Labour up to £75 p/hr",
  "Unlimited Claims",
  "Halfords MOT test",
  "14-Day Risk-Free Cancellation",
  "Vehicle age up to 15 years",
  "Mileage up to 60k miles",
  "Engine",
  "Gearbox",
  "Cooling System",
  "Swinging Arm Unit",
  "Clutch",
  "Instruments",
  "Electrical",
  "Ignition",
  "Final Drive Unit",
  "Suspension",
  "Front Telescopic Forks",
  "Brakes",
  "Casings",
  "Frame / Exhaust System",
  "Oil Leaks",
  "Replacement Hire",
  "Recovery",
  "European Cover"
]'::jsonb);
