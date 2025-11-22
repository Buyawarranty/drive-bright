-- Update Basic plan 36-month pricing
UPDATE plans 
SET pricing_matrix = jsonb_set(
  pricing_matrix,
  '{36}',
  '{
    "0": {"excess": "No Contribution", "price": 982},
    "50": {"excess": "£50", "price": 919},
    "100": {"excess": "£100", "price": 792},
    "150": {"excess": "£150", "price": 729}
  }'::jsonb
),
updated_at = now()
WHERE name = 'Basic';

-- Update Gold plan 36-month pricing
UPDATE plans 
SET pricing_matrix = jsonb_set(
  pricing_matrix,
  '{36}',
  '{
    "0": {"excess": "No Contribution", "price": 1077},
    "50": {"excess": "£50", "price": 982},
    "100": {"excess": "£100", "price": 855},
    "150": {"excess": "£150", "price": 824}
  }'::jsonb
),
updated_at = now()
WHERE name = 'Gold';

-- Update Platinum plan 36-month pricing
UPDATE plans 
SET pricing_matrix = jsonb_set(
  pricing_matrix,
  '{36}',
  '{
    "0": {"excess": "No Contribution", "price": 1153},
    "50": {"excess": "£50", "price": 1045},
    "100": {"excess": "£100", "price": 919},
    "150": {"excess": "£150", "price": 855}
  }'::jsonb
),
updated_at = now()
WHERE name = 'Platinum';

-- Update PHEV plan 36-month pricing
UPDATE special_vehicle_plans 
SET pricing_matrix = jsonb_set(
  pricing_matrix,
  '{36}',
  '{
    "0": {"excess": "No Contribution", "price": 1077},
    "50": {"excess": "£50", "price": 982},
    "100": {"excess": "£100", "price": 855},
    "150": {"excess": "£150", "price": 824}
  }'::jsonb
),
updated_at = now()
WHERE vehicle_type = 'phev';

-- Update EV plan 36-month pricing
UPDATE special_vehicle_plans 
SET pricing_matrix = jsonb_set(
  pricing_matrix,
  '{36}',
  '{
    "0": {"excess": "No Contribution", "price": 1077},
    "50": {"excess": "£50", "price": 982},
    "100": {"excess": "£100", "price": 855},
    "150": {"excess": "£150", "price": 824}
  }'::jsonb
),
updated_at = now()
WHERE vehicle_type = 'ev';

-- Update MOTORBIKE plan 36-month pricing
UPDATE special_vehicle_plans 
SET pricing_matrix = jsonb_set(
  pricing_matrix,
  '{36}',
  '{
    "0": {"excess": "No Contribution", "price": 1077},
    "50": {"excess": "£50", "price": 982},
    "100": {"excess": "£100", "price": 855},
    "150": {"excess": "£150", "price": 824}
  }'::jsonb
),
updated_at = now()
WHERE vehicle_type = 'motorbike';