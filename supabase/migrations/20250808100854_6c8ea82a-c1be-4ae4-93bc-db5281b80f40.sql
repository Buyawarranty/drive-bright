-- Add all missing plan types to ensure complete coverage
INSERT INTO plans (name, monthly_price, yearly_price, two_yearly_price, three_yearly_price, coverage, is_active) 
VALUES 
  ('Basic', 15.00, 180.00, 360.00, 540.00, '["Basic breakdown cover"]'::jsonb, true),
  ('Gold', 20.00, 240.00, 480.00, 720.00, '["Enhanced breakdown cover", "Extended warranty"]'::jsonb, true),
  ('Platinum', 25.00, 300.00, 600.00, 900.00, '["Premium breakdown cover", "Extended warranty", "Additional benefits"]'::jsonb, true),
  ('Motorbike Extended Warranty', 18.00, 216.00, 432.00, 648.00, '["Motorbike breakdown cover", "Extended warranty"]'::jsonb, true),
  ('PHEV Hybrid Extended Warranty', 24.00, 288.00, 576.00, 864.00, '["Hybrid breakdown cover", "Extended warranty"]'::jsonb, true)
ON CONFLICT (name) DO NOTHING;

-- Remove the restrictive check constraint on special_vehicle_plans table
ALTER TABLE special_vehicle_plans DROP CONSTRAINT IF EXISTS special_vehicle_plans_vehicle_type_check;

-- Add the special vehicle plans
INSERT INTO special_vehicle_plans (vehicle_type, name, monthly_price, yearly_price, two_yearly_price, three_yearly_price, coverage, is_active)
VALUES 
  ('motorbike', 'Motorbike Extended Warranty', 18.00, 216.00, 432.00, 648.00, '["Motorbike breakdown cover", "Extended warranty"]'::jsonb, true),
  ('electric', 'Electric Vehicle EV Extended Warranty', 26.00, 296.00, 592.00, 888.00, '["Breakdown cover", "Extended warranty"]'::jsonb, true),
  ('hybrid', 'PHEV Hybrid Extended Warranty', 24.00, 288.00, 576.00, 864.00, '["Hybrid breakdown cover", "Extended warranty"]'::jsonb, true)
ON CONFLICT (vehicle_type) DO NOTHING;