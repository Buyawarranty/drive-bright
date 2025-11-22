-- Update plans table with new pricing structure and coverage
UPDATE public.plans SET 
  monthly_price = 19,
  yearly_price = 228,
  two_yearly_price = 410.4,
  three_yearly_price = 602.88,
  coverage = '[
    "Engine",
    "Manual Gearbox", 
    "Automatic Transmission",
    "Torque Converter",
    "Overdrive",
    "Differential",
    "Electrics",
    "Casings",
    "Recovery"
  ]'::jsonb,
  add_ons = '[
    "Power Hood",
    "ECU", 
    "Air Conditioning",
    "Turbo"
  ]'::jsonb
WHERE name = 'Basic';

UPDATE public.plans SET 
  monthly_price = 26,
  yearly_price = 312,
  two_yearly_price = 561.6,
  three_yearly_price = 824.64,
  coverage = '[
    "Engine",
    "Manual Gearbox",
    "Automatic Transmission", 
    "Torque Converter",
    "Overdrive",
    "Differential",
    "Electrics",
    "Casings",
    "Recovery",
    "Clutch",
    "Cooling System",
    "Fuel System", 
    "Braking System",
    "Propshaft",
    "Vehicle Hire",
    "European Cover",
    "Halfords MOT test"
  ]'::jsonb,
  add_ons = '[
    "Power Hood",
    "ECU",
    "Air Conditioning", 
    "Turbo"
  ]'::jsonb
WHERE name = 'Gold';

UPDATE public.plans SET 
  monthly_price = 27,
  yearly_price = 324,
  two_yearly_price = 583.2,
  three_yearly_price = 856.32,
  coverage = '[
    "Engine",
    "Manual Gearbox",
    "Automatic Transmission",
    "Torque Converter", 
    "Overdrive",
    "Differential",
    "Electrics",
    "Casings",
    "Recovery",
    "Clutch",
    "Cooling System",
    "Fuel System",
    "Braking System", 
    "Propshaft",
    "Vehicle Hire",
    "European Cover",
    "Halfords MOT test",
    "Drive Shafts",
    "Steering",
    "Suspension",
    "Bearings",
    "Ventilation",
    "Locks",
    "Seals"
  ]'::jsonb,
  add_ons = '[
    "Power Hood"
  ]'::jsonb
WHERE name = 'Platinum';

-- Update special vehicle plans with new pricing and coverage
UPDATE public.special_vehicle_plans SET 
  monthly_price = 26,
  yearly_price = 312,
  two_yearly_price = 561.6,
  three_yearly_price = 824.64,
  coverage = '[
    "Labour up to £75 p/hr",
    "Unlimited Claims",
    "Engine",
    "Manual Gearbox",
    "Automatic Transmission",
    "Overdrive", 
    "Clutch",
    "Motor(s)",
    "Motor Power Supply",
    "Motor Control",
    "Battery System",
    "Fuel System",
    "Steering",
    "Suspension",
    "Cooling/Heating System",
    "Ancillary Electrics",
    "Brakes",
    "Locks",
    "Final Drive"
  ]'::jsonb
WHERE vehicle_type = 'PHEV' AND name = 'Gold';

UPDATE public.special_vehicle_plans SET 
  monthly_price = 26,
  yearly_price = 312,
  two_yearly_price = 561.6,
  three_yearly_price = 824.64,
  coverage = '[
    "Labour up to £75 p/hr",
    "Unlimited Claims", 
    "Motor(s)",
    "Motor Power Supply",
    "Motor Control",
    "Battery System",
    "Battery Cell Replacement",
    "Steering",
    "Suspension",
    "Brakes",
    "Ancillary Electrics",
    "Climate Control/Heating",
    "Locks"
  ]'::jsonb
WHERE vehicle_type = 'EV' AND name = 'Gold';

UPDATE public.special_vehicle_plans SET 
  monthly_price = 26,
  yearly_price = 312,
  two_yearly_price = 561.6,
  three_yearly_price = 824.64,
  coverage = '[
    "Labour up to £75 p/hr",
    "Unlimited Claims",
    "Engine", 
    "Gearbox",
    "Cooling System",
    "Clutch",
    "Swinging Arm Unit",
    "Instruments",
    "Ignition",
    "Final Drive Unit",
    "Front Telescopic Forks",
    "Frame/Exhaust System",
    "Oil Leaks",
    "Recovery",
    "Replacement Hire",
    "European Cover"
  ]'::jsonb
WHERE vehicle_type = 'MOTORBIKE' AND name = 'Gold';

-- Add labour rate information to regular plans
UPDATE public.plans SET 
  coverage = coverage || '["Labour up to £35 p/hr", "Max 10 claims per year"]'::jsonb
WHERE name = 'Basic';

UPDATE public.plans SET 
  coverage = coverage || '["Labour up to £75 p/hr", "Unlimited Claims"]'::jsonb
WHERE name = 'Gold';

UPDATE public.plans SET 
  coverage = coverage || '["Labour up to £100 p/hr", "Unlimited Claims"]'::jsonb
WHERE name = 'Platinum';