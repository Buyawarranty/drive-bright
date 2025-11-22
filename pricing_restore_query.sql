-- Restore pricing for standard plans (Basic, Gold, Platinum)
UPDATE plans 
SET 
  monthly_price = CASE 
    WHEN name = 'Basic' THEN 25.00
    WHEN name = 'Gold' THEN 35.00  
    WHEN name = 'Platinum' THEN 45.00
    ELSE monthly_price
  END,
  yearly_price = CASE 
    WHEN name = 'Basic' THEN 540.00
    WHEN name = 'Gold' THEN 734.00
    WHEN name = 'Platinum' THEN 786.00
    ELSE yearly_price
  END,
  three_yearly_price = CASE 
    WHEN name = 'Basic' THEN 792.00
    WHEN name = 'Gold' THEN 1077.00
    WHEN name = 'Platinum' THEN 1153.00
    ELSE three_yearly_price
  END,
  pricing_matrix = CASE 
    WHEN name = 'Basic' THEN '{
      "12": {
        "0": {"price": 31, "excess": "No Contribution"},
        "50": {"price": 29, "excess": "£50"},
        "100": {"price": 25, "excess": "£100"},
        "150": {"price": 23, "excess": "£150"}
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
        "0": {"price": 34, "excess": "No Contribution"},
        "50": {"price": 31, "excess": "£50"},
        "100": {"price": 27, "excess": "£100"},
        "150": {"price": 27, "excess": "£150"}
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
        "0": {"price": 36, "excess": "No Contribution"},
        "50": {"price": 33, "excess": "£50"},
        "100": {"price": 29, "excess": "£100"},
        "150": {"price": 27, "excess": "£150"}
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

-- Restore pricing for special vehicle plans (PHEV, EV, MOTORBIKE)
UPDATE special_vehicle_plans 
SET 
  monthly_price = CASE 
    WHEN vehicle_type = 'PHEV' THEN 35.00
    WHEN vehicle_type = 'EV' THEN 35.00  
    WHEN vehicle_type = 'MOTORBIKE' THEN 30.00
    ELSE monthly_price
  END,
  yearly_price = CASE 
    WHEN vehicle_type = 'PHEV' THEN 734.00
    WHEN vehicle_type = 'EV' THEN 734.00
    WHEN vehicle_type = 'MOTORBIKE' THEN 670.00
    ELSE yearly_price
  END,
  three_yearly_price = CASE 
    WHEN vehicle_type = 'PHEV' THEN 1077.00
    WHEN vehicle_type = 'EV' THEN 1077.00
    WHEN vehicle_type = 'MOTORBIKE' THEN 982.00
    ELSE three_yearly_price
  END,
  pricing_matrix = CASE 
    WHEN vehicle_type IN ('PHEV', 'EV') THEN '{
      "12": {
        "0": {"price": 34, "excess": "No Contribution"},
        "50": {"price": 31, "excess": "£50"},
        "100": {"price": 27, "excess": "£100"},
        "150": {"price": 27, "excess": "£150"}
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
        "0": {"price": 34, "excess": "No Contribution"},
        "50": {"price": 31, "excess": "£50"},
        "100": {"price": 27, "excess": "£100"},
        "150": {"price": 27, "excess": "£150"}
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