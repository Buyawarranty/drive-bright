
-- Backfill: create leads from recent abandoned carts that don't have corresponding sales_leads
INSERT INTO sales_leads (first_name, last_name, email, phone, lead_source, status, priority, vehicle_reg, vehicle_make, vehicle_model, vehicle_year, vehicle_type, mileage, plan_interest, cart_value, abandoned_cart_id)
SELECT 
  SPLIT_PART(COALESCE(ac.full_name, ac.email), ' ', 1),
  NULLIF(TRIM(SUBSTRING(COALESCE(ac.full_name, '') FROM POSITION(' ' IN COALESCE(ac.full_name, '')) + 1)), ''),
  LOWER(ac.email),
  ac.phone,
  'website',
  'new',
  'medium',
  ac.vehicle_reg,
  ac.vehicle_make,
  ac.vehicle_model,
  ac.vehicle_year,
  ac.vehicle_type,
  ac.mileage,
  ac.plan_name,
  ac.total_price,
  ac.id
FROM abandoned_carts ac
WHERE ac.created_at > now() - interval '24 hours'
  AND NOT EXISTS (
    SELECT 1 FROM sales_leads sl 
    WHERE LOWER(sl.email) = LOWER(ac.email) 
    AND sl.is_paid = false 
    AND sl.status NOT IN ('converted', 'lost', 'fake_lead')
  )
ORDER BY ac.created_at DESC;
