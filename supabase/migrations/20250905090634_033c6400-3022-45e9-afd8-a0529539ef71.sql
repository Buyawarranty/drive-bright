-- Update 1-year pricing to match the new price table
-- Mapping: Basic (£750 claim limit), Gold (£1,250 claim limit), Platinum (£2,000 claim limit)

UPDATE plans 
SET 
  pricing_matrix = jsonb_set(
    COALESCE(pricing_matrix, '{}'),
    '{12}',
    CASE 
      WHEN name = 'Basic' THEN '{
        "0": {"price": 467, "excess": "No Contribution"},
        "50": {"price": 437, "excess": "£50"},
        "100": {"price": 387, "excess": "£100"},
        "150": {"price": 367, "excess": "£150"}
      }'::jsonb
      WHEN name = 'Gold' THEN '{
        "0": {"price": 497, "excess": "No Contribution"},
        "50": {"price": 457, "excess": "£50"},
        "100": {"price": 417, "excess": "£100"},
        "150": {"price": 387, "excess": "£150"}
      }'::jsonb
      WHEN name = 'Platinum' THEN '{
        "0": {"price": 587, "excess": "No Contribution"},
        "50": {"price": 547, "excess": "£50"},
        "100": {"price": 507, "excess": "£100"},
        "150": {"price": 477, "excess": "£150"}
      }'::jsonb
      ELSE COALESCE(pricing_matrix->>'12', '{}')::jsonb
    END
  ),
  updated_at = now()
WHERE name IN ('Basic', 'Gold', 'Platinum');

-- Update special vehicle plans with same 1-year pricing structure
UPDATE special_vehicle_plans 
SET 
  pricing_matrix = jsonb_set(
    COALESCE(pricing_matrix, '{}'),
    '{12}',
    CASE 
      WHEN vehicle_type IN ('PHEV', 'EV') THEN '{
        "0": {"price": 497, "excess": "No Contribution"},
        "50": {"price": 457, "excess": "£50"},
        "100": {"price": 417, "excess": "£100"},
        "150": {"price": 387, "excess": "£150"}
      }'::jsonb
      WHEN vehicle_type = 'MOTORBIKE' THEN '{
        "0": {"price": 467, "excess": "No Contribution"},
        "50": {"price": 437, "excess": "£50"},
        "100": {"price": 387, "excess": "£100"},
        "150": {"price": 367, "excess": "£150"}
      }'::jsonb
      ELSE COALESCE(pricing_matrix->>'12', '{}')::jsonb
    END
  ),
  updated_at = now()
WHERE vehicle_type IN ('PHEV', 'EV', 'MOTORBIKE');