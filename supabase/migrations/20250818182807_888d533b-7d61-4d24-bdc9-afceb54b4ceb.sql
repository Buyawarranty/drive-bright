-- Update PHEV to match MOTORBIKE pricing exactly
UPDATE special_vehicle_plans 
SET 
  monthly_price = 34,
  yearly_price = 408,
  two_yearly_price = 777,
  three_yearly_price = 600.00,
  pricing_matrix = jsonb_build_object(
    '24', jsonb_build_object(
      '0', jsonb_build_object('price', 61, 'excess', 'No Contribution'),
      '50', jsonb_build_object('price', 56, 'excess', '£50'),
      '100', jsonb_build_object('price', 49, 'excess', '£100'),
      '150', jsonb_build_object('price', 47, 'excess', '£150')
    ),
    '36', jsonb_build_object(
      '0', jsonb_build_object('price', 90, 'excess', 'No Contribution'),
      '50', jsonb_build_object('price', 82, 'excess', '£50'),
      '100', jsonb_build_object('price', 71, 'excess', '£100'),
      '150', jsonb_build_object('price', 69, 'excess', '£150')
    ),
    'monthly', jsonb_build_object(
      '0', 34,
      '50', 31,
      '100', 27,
      '150', 27
    ),
    'yearly', jsonb_build_object(
      '0', 408,
      '50', 372,
      '100', 324,
      '150', 312
    )
  ),
  updated_at = now()
WHERE vehicle_type = 'PHEV';

-- Update EV to match MOTORBIKE pricing exactly  
UPDATE special_vehicle_plans 
SET 
  monthly_price = 34,
  yearly_price = 408,
  two_yearly_price = 777,
  three_yearly_price = 600.00,
  pricing_matrix = jsonb_build_object(
    '24', jsonb_build_object(
      '0', jsonb_build_object('price', 61, 'excess', 'No Contribution'),
      '50', jsonb_build_object('price', 56, 'excess', '£50'),
      '100', jsonb_build_object('price', 49, 'excess', '£100'),
      '150', jsonb_build_object('price', 47, 'excess', '£150')
    ),
    '36', jsonb_build_object(
      '0', jsonb_build_object('price', 90, 'excess', 'No Contribution'),
      '50', jsonb_build_object('price', 82, 'excess', '£50'),
      '100', jsonb_build_object('price', 71, 'excess', '£100'),
      '150', jsonb_build_object('price', 69, 'excess', '£150')
    ),
    'monthly', jsonb_build_object(
      '0', 34,
      '50', 31,
      '100', 27,
      '150', 27
    ),
    'yearly', jsonb_build_object(
      '0', 408,
      '50', 372,
      '100', 324,
      '150', 312
    )
  ),
  updated_at = now()
WHERE vehicle_type = 'EV';