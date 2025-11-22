-- Create customer record for Kam Qureshi
INSERT INTO public.customers (
  name, email, phone, first_name, last_name, street, town, postcode, country,
  plan_type, payment_type, registration_plate, vehicle_make, vehicle_model, vehicle_year,
  vehicle_fuel_type, status, warranty_reference_number
) VALUES (
  'Kam Qureshi',
  'hello@lux1.com', 
  '07960111131',
  'Kam',
  'Qureshi',
  '41 Blawith Road',
  'Middlesex',
  'HA1 1TL',
  'United Kingdom',
  'Extended',
  'yearly',
  'WV67 CYL',
  'NISSAN',
  'Unknown',
  '2017',
  'Electric',
  'Active',
  public.generate_warranty_number()
);

-- Create customer policy record for Kam Qureshi
INSERT INTO public.customer_policies (
  customer_id,
  email,
  plan_type,
  payment_type,
  policy_number,
  policy_start_date,
  policy_end_date,
  status,
  payment_amount,
  payment_currency
) 
SELECT 
  c.id,
  'hello@lux1.com',
  'extended',
  'yearly',
  c.warranty_reference_number,
  NOW(),
  NOW() + INTERVAL '1 year',
  'active',
  296.00,
  'GBP'
FROM public.customers c 
WHERE c.email = 'hello@lux1.com';