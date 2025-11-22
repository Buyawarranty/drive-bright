-- Update 1-year pricing based on new pricing structure from screenshot
-- Mapping: Basic (£750 claim limit), Gold (£1,250 claim limit), Platinum (£2,000 claim limit)

UPDATE plans 
SET 
  pricing_matrix = CASE 
    WHEN name = 'Basic' THEN '{
      "12": {
        "0": {"price": 467, "excess": "No Contribution"},
        "50": {"price": 437, "excess": "£50"},
        "100": {"price": 387, "excess": "£100"},
        "150": {"price": 367, "excess": "£150"}
      },
      "24": {
        "0": {"price": 670, "excess": "No Contribution"},
        "50": {"price": 626, "excess": "£50"},
        "100": {"price": 540, "excess": "£100"},
        "150": {"price": 497, "excess": "£150"}
      },
      "36": {
        "0": {"price": 982, "excess": "No Contribution"},
        "50": {"price": 919, "excess": "£50"},
        "100": {"price": 792, "excess": "£100"},
        "150": {"price": 729, "excess": "£150"}
      }
    }'::jsonb
    WHEN name = 'Gold' THEN '{
      "12": {
        "0": {"price": 497, "excess": "No Contribution"},
        "50": {"price": 457, "excess": "£50"},
        "100": {"price": 417, "excess": "£100"},
        "150": {"price": 387, "excess": "£150"}
      },
      "24": {
        "0": {"price": 734, "excess": "No Contribution"},
        "50": {"price": 670, "excess": "£50"},
        "100": {"price": 583, "excess": "£100"},
        "150": {"price": 562, "excess": "£150"}
      },
      "36": {
        "0": {"price": 1077, "excess": "No Contribution"},
        "50": {"price": 982, "excess": "£50"},
        "100": {"price": 855, "excess": "£100"},
        "150": {"price": 824, "excess": "£150"}
      }
    }'::jsonb
    WHEN name = 'Platinum' THEN '{
      "12": {
        "0": {"price": 587, "excess": "No Contribution"},
        "50": {"price": 547, "excess": "£50"},
        "100": {"price": 507, "excess": "£100"},
        "150": {"price": 477, "excess": "£150"}
      },
      "24": {
        "0": {"price": 786, "excess": "No Contribution"},
        "50": {"price": 713, "excess": "£50"},
        "100": {"price": 626, "excess": "£100"},
        "150": {"price": 583, "excess": "£150"}
      },
      "36": {
        "0": {"price": 1153, "excess": "No Contribution"},
        "50": {"price": 1045, "excess": "£50"},
        "100": {"price": 919, "excess": "£100"},
        "150": {"price": 855, "excess": "£150"}
      }
    }'::jsonb
    ELSE pricing_matrix
  END,
  updated_at = now()
WHERE name IN ('Basic', 'Gold', 'Platinum');

-- Update special vehicle plans with same 1-year pricing structure
UPDATE special_vehicle_plans 
SET 
  pricing_matrix = CASE 
    WHEN vehicle_type IN ('PHEV', 'EV') THEN '{
      "12": {
        "0": {"price": 497, "excess": "No Contribution"},
        "50": {"price": 457, "excess": "£50"},
        "100": {"price": 417, "excess": "£100"},
        "150": {"price": 387, "excess": "£150"}
      },
      "24": {
        "0": {"price": 734, "excess": "No Contribution"},
        "50": {"price": 670, "excess": "£50"},
        "100": {"price": 583, "excess": "£100"},
        "150": {"price": 562, "excess": "£150"}
      },
      "36": {
        "0": {"price": 1077, "excess": "No Contribution"},
        "50": {"price": 982, "excess": "£50"},
        "100": {"price": 855, "excess": "£100"},
        "150": {"price": 824, "excess": "£150"}
      }
    }'::jsonb
    WHEN vehicle_type = 'MOTORBIKE' THEN '{
      "12": {
        "0": {"price": 467, "excess": "No Contribution"},
        "50": {"price": 437, "excess": "£50"},
        "100": {"price": 387, "excess": "£100"},
        "150": {"price": 367, "excess": "£150"}
      },
      "24": {
        "0": {"price": 734, "excess": "No Contribution"},
        "50": {"price": 670, "excess": "£50"},
        "100": {"price": 583, "excess": "£100"},
        "150": {"price": 562, "excess": "£150"}
      },
      "36": {
        "0": {"price": 1077, "excess": "No Contribution"},
        "50": {"price": 982, "excess": "£50"},
        "100": {"price": 855, "excess": "£100"},
        "150": {"price": 824, "excess": "£150"}
      }
    }'::jsonb
    ELSE pricing_matrix
  END,
  updated_at = now()
WHERE vehicle_type IN ('PHEV', 'EV', 'MOTORBIKE');