
-- Manually recover the failed lead for rashid6336@gmail.com / LK17 EYO
-- This lead failed to create due to the get_next_sales_user() bug
INSERT INTO public.sales_leads (
  first_name, last_name, email, phone, lead_source, status, priority,
  vehicle_reg, vehicle_make, vehicle_model, vehicle_year, vehicle_type,
  mileage, plan_interest, abandoned_cart_id, created_at, updated_at, last_activity_date,
  resubmission_count, is_paid
)
SELECT
  'Rashid', 'Mohammed', 'rashid6336@gmail.com', '07746374090',
  'google_ad'::lead_source, 'new'::lead_status, 'medium',
  'LK17 EYO', ac.vehicle_make, ac.vehicle_model, ac.vehicle_year, ac.vehicle_type,
  ac.mileage, ac.plan_name, ac.id, ac.created_at, now(), now(),
  0, true
FROM abandoned_carts ac
WHERE ac.id = 'ebb6bd58-97cb-433e-9ec4-97e6cb6186f9'
AND NOT EXISTS (
  SELECT 1 FROM sales_leads WHERE email = 'rashid6336@gmail.com' AND created_at > now() - interval '7 days'
);
