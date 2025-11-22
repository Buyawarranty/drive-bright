
-- Insert fake customer data for testing the admin dashboard
INSERT INTO public.customers (name, email, plan_type, registration_plate, voluntary_excess, status) VALUES
('John Smith', 'john.smith@email.com', 'Basic', 'PL67KUB', 250, 'Active'),
('Sarah Johnson', 'sarah.johnson@email.com', 'Gold', 'DG62LBY', 500, 'Active'),
('Mike Williams', 'mike.williams@email.com', 'Platinum', 'YA14NCY', 750, 'Active'),
('Emma Brown', 'emma.brown@email.com', 'Basic', 'H12FXL', 250, 'Active'),
('David Wilson', 'david.wilson@email.com', 'Gold', 'BX18TRF', 500, 'Cancelled'),
('Lisa Davis', 'lisa.davis@email.com', 'Platinum', 'MN21QWE', 1000, 'Active'),
('Tom Anderson', 'tom.anderson@email.com', 'Basic', 'RT19ZXC', 250, 'Active'),
('Jane Miller', 'jane.miller@email.com', 'Gold', 'KL20VBN', 500, 'Active')
ON CONFLICT (email) DO NOTHING;

-- Reset the plans to have correct features and pricing
UPDATE public.plans 
SET coverage = '["Mechanical Breakdown Protection", "Labour up to £35 p/hr", "10 Claims per year", "Engine", "Manual Gearbox", "Automatic Transmission", "Torque Convertor", "Overdrive", "Differential", "Electrics", "Casings", "Recovery"]'::jsonb,
    add_ons = '["Power Hood", "ECU", "Air Conditioning", "Turbo"]'::jsonb
WHERE name = 'Basic';

UPDATE public.plans 
SET coverage = '["Mechanical & Electrical Breakdown Warranty", "Labour up to £75 p/hr", "Halfords MOT test", "Unlimited Claims", "Engine", "Manual Gearbox", "Automatic Transmission", "Overdrive", "Clutch", "Differential", "Torque Convertor", "Cooling System", "Fuel System", "Electricals", "Braking System", "Propshaft", "Casings", "Vehicle Hire", "Recovery", "European Cover"]'::jsonb,
    add_ons = '["Power Hood", "ECU", "Air Conditioning", "Turbo"]'::jsonb
WHERE name = 'Gold';

UPDATE public.plans 
SET coverage = '["Mechanical & Electrical Breakdown", "Labour up to £100 p/hr", "Halfords MOT test", "Unlimited Claims", "Engine", "Turbo Unit", "Manual Gearbox", "Automatic Transmission", "Clutch", "Differential", "Drive Shafts", "Brakes", "Steering", "Suspension", "Bearings", "Cooling System", "Ventilation", "ECU", "Electrics", "Fuel System", "Air Conditioning", "Locks", "Seals", "Casings", "Vehicle Hire", "Vehicle Recovery", "European Cover"]'::jsonb,
    add_ons = '["Power Hood"]'::jsonb
WHERE name = 'Platinum';
