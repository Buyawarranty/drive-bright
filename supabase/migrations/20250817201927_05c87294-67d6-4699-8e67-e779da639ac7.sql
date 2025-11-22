-- Update 24-month pricing: double 12-month prices and apply 10% discount
-- Formula: 24-month price = (12-month price × 2) × 0.9

-- Update standard plans pricing matrix for 24-month periods
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
        "0": {"price": 612, "excess": "No Contribution"},
        "50": {"price": 558, "excess": "£50"},
        "100": {"price": 486, "excess": "£100"},
        "150": {"price": 486, "excess": "£150"}
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
        "0": {"price": 648, "excess": "No Contribution"},
        "50": {"price": 594, "excess": "£50"},
        "100": {"price": 522, "excess": "£100"},
        "150": {"price": 486, "excess": "£150"}
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
  yearly_price = CASE 
    WHEN name = 'Basic' THEN 450.00
    WHEN name = 'Gold' THEN 486.00
    WHEN name = 'Platinum' THEN 522.00
    ELSE yearly_price
  END,
  updated_at = now()
WHERE name IN ('Basic', 'Gold', 'Platinum');

-- Update special vehicle plans pricing matrix for 24-month periods
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
        "0": {"price": 1077, "excess": "No Contribution"},
        "50": {"price": 982, "excess": "£50"},
        "100": {"price": 855, "excess": "£100"},
        "150": {"price": 824, "excess": "£150"}
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
        "0": {"price": 982, "excess": "No Contribution"},
        "50": {"price": 919, "excess": "£50"},
        "100": {"price": 792, "excess": "£100"},
        "150": {"price": 729, "excess": "£150"}
      }
    }'::jsonb
    ELSE pricing_matrix
  END,
  yearly_price = CASE 
    WHEN vehicle_type IN ('PHEV', 'EV') THEN 486.00
    WHEN vehicle_type = 'MOTORBIKE' THEN 450.00
    ELSE yearly_price
  END,
  updated_at = now()
WHERE vehicle_type IN ('PHEV', 'EV', 'MOTORBIKE');