
-- Create some test customer policies with real auth users
-- First, let's add some sample customer policies that can be used for testing
INSERT INTO public.customer_policies (
  email, 
  plan_type, 
  payment_type, 
  policy_number, 
  policy_end_date, 
  status,
  address
) VALUES
('test.customer@example.com', 'basic', 'monthly', 'POL-20250626-0001', '2026-01-26T00:00:00Z', 'active', '{"street": "123 Test Street", "city": "London", "postcode": "SW1A 1AA", "country": "United Kingdom"}'),
('premium.user@example.com', 'gold', 'yearly', 'POL-20250626-0002', '2025-12-26T00:00:00Z', 'active', '{"street": "456 Premium Avenue", "city": "Manchester", "postcode": "M1 1AA", "country": "United Kingdom"}'),
('platinum.customer@example.com', 'platinum', 'twoYear', 'POL-20250626-0003', '2027-06-26T00:00:00Z', 'active', '{"street": "789 Platinum Court", "city": "Birmingham", "postcode": "B1 1AA", "country": "United Kingdom"}');
