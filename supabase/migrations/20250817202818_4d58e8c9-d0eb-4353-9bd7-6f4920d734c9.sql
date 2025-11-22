-- Update 36-month pricing: triple 12-month prices and apply 20% discount
-- Formula: 36-month price = (12-month price × 3) × 0.8

-- Update standard plans pricing matrix for 36-month periods
UPDATE plans 
SET 
  pricing_matrix = CASE 
    WHEN name = 'Basic' THEN '{
      "12": {
        "0": {"price": 31, "excess": "No Contribution"},
        "50": {"price": 29, "excess": "£50"},
        "100": {"price": 25, "excess": "£100"},
        "150": {"price": 23, "excess": "£150"}
      },
      "24": {
        "0": {"price": 558, "excess": "No Contribution"},
        "50": {"price": 522, "excess": "£50"},
        "100": {"price": 450, "excess": "£100"},
        "150": {"price": 414, "excess": "£150"}
      },
      "36": {
        "0": {"price": 744, "excess": "No Contribution"},
        "50": {"price": 696, "excess": "£50"},
        "100": {"price": 600, "excess": "£100"},
        "150": {"price": 552, "excess": "£150"}
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
        "0": {"price": 612, "excess": "No Contribution"},
        "50": {"price": 558, "excess": "£50"},
        "100": {"price": 486, "excess": "£100"},
        "150": {"price": 486, "excess": "£150"}
      },
      "36": {
        "0": {"price": 816, "excess": "No Contribution"},
        "50": {"price": 744, "excess": "£50"},
        "100": {"price": 648, "excess": "£100"},
        "150": {"price": 648, "excess": "£150"}
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
        "0": {"price": 648, "excess": "No Contribution"},
        "50": {"price": 594, "excess": "£50"},
        "100": {"price": 522, "excess": "£100"},
        "150": {"price": 486, "excess": "£150"}
      },
      "36": {
        "0": {"price": 864, "excess": "No Contribution"},
        "50": {"price": 792, "excess": "£50"},
        "100": {"price": 696, "excess": "£100"},
        "150": {"price": 648, "excess": "£150"}
      }
    }'::jsonb
    ELSE pricing_matrix
  END,
  three_yearly_price = CASE 
    WHEN name = 'Basic' THEN 600.00
    WHEN name = 'Gold' THEN 648.00
    WHEN name = 'Platinum' THEN 696.00
    ELSE three_yearly_price
  END,
  updated_at = now()
WHERE name IN ('Basic', 'Gold', 'Platinum');

-- Update special vehicle plans pricing matrix for 36-month periods
UPDATE special_vehicle_plans 
SET 
  pricing_matrix = CASE 
    WHEN vehicle_type IN ('PHEV', 'EV') THEN '{
      "12": {
        "0": {"price": 34, "excess": "No Contribution"},
        "50": {"price": 31, "excess": "£50"},
        "100": {"price": 27, "excess": "£100"},
        "150": {"price": 27, "excess": "£150"}
      },
      "24": {
        "0": {"price": 612, "excess": "No Contribution"},
        "50": {"price": 558, "excess": "£50"},
        "100": {"price": 486, "excess": "£100"},
        "150": {"price": 486, "excess": "£150"}
      },
      "36": {
        "0": {"price": 816, "excess": "No Contribution"},
        "50": {"price": 744, "excess": "£50"},
        "100": {"price": 648, "excess": "£100"},
        "150": {"price": 648, "excess": "£150"}
      }
    }'::jsonb
    WHEN vehicle_type = 'MOTORBIKE' THEN '{
      "12": {
        "0": {"price": 31, "excess": "No Contribution"},
        "50": {"price": 29, "excess": "£50"},
        "100": {"price": 25, "excess": "£100"},
        "150": {"price": 23, "excess": "£150"}
      },
      "24": {
        "0": {"price": 558, "excess": "No Contribution"},
        "50": {"price": 522, "excess": "£50"},
        "100": {"price": 450, "excess": "£100"},
        "150": {"price": 414, "excess": "£150"}
      },
      "36": {
        "0": {"price": 744, "excess": "No Contribution"},
        "50": {"price": 696, "excess": "£50"},
        "100": {"price": 600, "excess": "£100"},
        "150": {"price": 552, "excess": "£150"}
      }
    }'::jsonb
    ELSE pricing_matrix
  END,
  three_yearly_price = CASE 
    WHEN vehicle_type IN ('PHEV', 'EV') THEN 648.00
    WHEN vehicle_type = 'MOTORBIKE' THEN 600.00
    ELSE three_yearly_price
  END,
  updated_at = now()
WHERE vehicle_type IN ('PHEV', 'EV', 'MOTORBIKE');