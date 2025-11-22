-- Merge uppercase vehicle_type rows into lowercase keys, then clean up
INSERT INTO public.special_vehicle_plans (
  name, vehicle_type, monthly_price, yearly_price, two_yearly_price, three_yearly_price,
  coverage, pricing_matrix, is_active
)
SELECT name, lower(vehicle_type), monthly_price, yearly_price, two_yearly_price, three_yearly_price,
       coverage, pricing_matrix, is_active
FROM public.special_vehicle_plans
WHERE vehicle_type IN ('CAR','VAN','SUV','MOTORBIKE')
ON CONFLICT (vehicle_type)
DO UPDATE SET
  name = EXCLUDED.name,
  monthly_price = EXCLUDED.monthly_price,
  yearly_price = EXCLUDED.yearly_price,
  two_yearly_price = EXCLUDED.two_yearly_price,
  three_yearly_price = EXCLUDED.three_yearly_price,
  coverage = EXCLUDED.coverage,
  pricing_matrix = EXCLUDED.pricing_matrix,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- Remove legacy uppercase rows
DELETE FROM public.special_vehicle_plans WHERE vehicle_type IN ('CAR','VAN','SUV','MOTORBIKE');