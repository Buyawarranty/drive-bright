-- Update Basic plan 24-month pricing
UPDATE plans 
SET pricing_matrix = jsonb_set(
  pricing_matrix,
  '{24}',
  '{
    "0": {"excess": "No Contribution", "price": 670},
    "50": {"excess": "£50", "price": 626},
    "100": {"excess": "£100", "price": 540},
    "150": {"excess": "£150", "price": 497}
  }'::jsonb
),
updated_at = now()
WHERE name = 'Basic';

-- Update Gold plan 24-month pricing
UPDATE plans 
SET pricing_matrix = jsonb_set(
  pricing_matrix,
  '{24}',
  '{
    "0": {"excess": "No Contribution", "price": 734},
    "50": {"excess": "£50", "price": 670},
    "100": {"excess": "£100", "price": 583},
    "150": {"excess": "£150", "price": 562}
  }'::jsonb
),
updated_at = now()
WHERE name = 'Gold';

-- Update Platinum plan 24-month pricing
UPDATE plans 
SET pricing_matrix = jsonb_set(
  pricing_matrix,
  '{24}',
  '{
    "0": {"excess": "No Contribution", "price": 786},
    "50": {"excess": "£50", "price": 713},
    "100": {"excess": "£100", "price": 626},
    "150": {"excess": "£150", "price": 583}
  }'::jsonb
),
updated_at = now()
WHERE name = 'Platinum';

-- Update PHEV plan 24-month pricing
UPDATE special_vehicle_plans 
SET pricing_matrix = jsonb_set(
  pricing_matrix,
  '{24}',
  '{
    "0": {"excess": "No Contribution", "price": 734},
    "50": {"excess": "£50", "price": 670},
    "100": {"excess": "£100", "price": 583},
    "150": {"excess": "£150", "price": 562}
  }'::jsonb
),
updated_at = now()
WHERE vehicle_type = 'phev';

-- Update EV plan 24-month pricing
UPDATE special_vehicle_plans 
SET pricing_matrix = jsonb_set(
  pricing_matrix,
  '{24}',
  '{
    "0": {"excess": "No Contribution", "price": 734},
    "50": {"excess": "£50", "price": 670},
    "100": {"excess": "£100", "price": 583},
    "150": {"excess": "£150", "price": 562}
  }'::jsonb
),
updated_at = now()
WHERE vehicle_type = 'ev';

-- Update MOTORBIKE plan 24-month pricing
UPDATE special_vehicle_plans 
SET pricing_matrix = jsonb_set(
  pricing_matrix,
  '{24}',
  '{
    "0": {"excess": "No Contribution", "price": 734},
    "50": {"excess": "£50", "price": 670},
    "100": {"excess": "£100", "price": 583},
    "150": {"excess": "£150", "price": 562}
  }'::jsonb
),
updated_at = now()
WHERE vehicle_type = 'motorbike';