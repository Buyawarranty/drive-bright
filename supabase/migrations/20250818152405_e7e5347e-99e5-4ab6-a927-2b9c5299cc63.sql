-- Update pricing for Basic plans
UPDATE plans 
SET 
  monthly_price = 31,
  yearly_price = 372,
  pricing_matrix = jsonb_build_object(
    'monthly', jsonb_build_object(
      '0', 31,
      '50', 29,
      '100', 25,
      '150', 23
    ),
    'yearly', jsonb_build_object(
      '0', 372,
      '50', 348,
      '100', 300,
      '150', 276
    )
  )
WHERE name = 'Basic' AND is_active = true;

-- Update pricing for Gold plans
UPDATE plans 
SET 
  monthly_price = 34,
  yearly_price = 408,
  pricing_matrix = jsonb_build_object(
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
  )
WHERE name = 'Gold' AND is_active = true;

-- Update pricing for Platinum plans
UPDATE plans 
SET 
  monthly_price = 36,
  yearly_price = 437,
  pricing_matrix = jsonb_build_object(
    'monthly', jsonb_build_object(
      '0', 36,
      '50', 33,
      '100', 29,
      '150', 27
    ),
    'yearly', jsonb_build_object(
      '0', 437,
      '50', 396,
      '100', 348,
      '150', 324
    )
  )
WHERE name = 'Platinum' AND is_active = true;

-- Update special vehicle plans for PHEV
UPDATE special_vehicle_plans 
SET 
  monthly_price = 34,
  yearly_price = 408,
  pricing_matrix = jsonb_build_object(
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
  )
WHERE vehicle_type = 'PHEV' AND is_active = true;

-- Update special vehicle plans for EV
UPDATE special_vehicle_plans 
SET 
  monthly_price = 34,
  yearly_price = 408,
  pricing_matrix = jsonb_build_object(
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
  )
WHERE vehicle_type = 'EV' AND is_active = true;

-- Update special vehicle plans for MOTORBIKE
UPDATE special_vehicle_plans 
SET 
  monthly_price = 34,
  yearly_price = 408,
  pricing_matrix = jsonb_build_object(
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
  )
WHERE vehicle_type = 'MOTORBIKE' AND is_active = true;