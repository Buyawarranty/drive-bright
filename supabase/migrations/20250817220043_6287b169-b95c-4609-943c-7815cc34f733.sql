-- Update Basic plan pricing matrix
UPDATE plans 
SET pricing_matrix = '{
  "12": {
    "0": {"excess": "No Contribution", "price": 31},
    "50": {"excess": "£50", "price": 29},
    "100": {"excess": "£100", "price": 25},
    "150": {"excess": "£150", "price": 23}
  },
  "24": {
    "0": {"excess": "No Contribution", "price": 372},
    "50": {"excess": "£50", "price": 348},
    "100": {"excess": "£100", "price": 300},
    "150": {"excess": "£150", "price": 276}
  },
  "36": {
    "0": {"excess": "No Contribution", "price": 982},
    "50": {"excess": "£50", "price": 919},
    "100": {"excess": "£100", "price": 792},
    "150": {"excess": "£150", "price": 729}
  }
}'::jsonb,
updated_at = now()
WHERE name = 'Basic';

-- Update Gold plan pricing matrix
UPDATE plans 
SET pricing_matrix = '{
  "12": {
    "0": {"excess": "No Contribution", "price": 34},
    "50": {"excess": "£50", "price": 31},
    "100": {"excess": "£100", "price": 27},
    "150": {"excess": "£150", "price": 27}
  },
  "24": {
    "0": {"excess": "No Contribution", "price": 408},
    "50": {"excess": "£50", "price": 372},
    "100": {"excess": "£100", "price": 324},
    "150": {"excess": "£150", "price": 312}
  },
  "36": {
    "0": {"excess": "No Contribution", "price": 1077},
    "50": {"excess": "£50", "price": 982},
    "100": {"excess": "£100", "price": 855},
    "150": {"excess": "£150", "price": 824}
  }
}'::jsonb,
updated_at = now()
WHERE name = 'Gold';

-- Update Platinum plan pricing matrix
UPDATE plans 
SET pricing_matrix = '{
  "12": {
    "0": {"excess": "No Contribution", "price": 36},
    "50": {"excess": "£50", "price": 33},
    "100": {"excess": "£100", "price": 29},
    "150": {"excess": "£150", "price": 27}
  },
  "24": {
    "0": {"excess": "No Contribution", "price": 437},
    "50": {"excess": "£50", "price": 396},
    "100": {"excess": "£100", "price": 348},
    "150": {"excess": "£150", "price": 324}
  },
  "36": {
    "0": {"excess": "No Contribution", "price": 1153},
    "50": {"excess": "£50", "price": 1045},
    "100": {"excess": "£100", "price": 919},
    "150": {"excess": "£150", "price": 855}
  }
}'::jsonb,
updated_at = now()
WHERE name = 'Platinum';

-- Update PHEV plan pricing matrix
UPDATE special_vehicle_plans 
SET pricing_matrix = '{
  "12": {
    "0": {"excess": "No Contribution", "price": 34},
    "50": {"excess": "£50", "price": 31},
    "100": {"excess": "£100", "price": 27},
    "150": {"excess": "£150", "price": 27}
  },
  "24": {
    "0": {"excess": "No Contribution", "price": 408},
    "50": {"excess": "£50", "price": 372},
    "100": {"excess": "£100", "price": 324},
    "150": {"excess": "£150", "price": 312}
  },
  "36": {
    "0": {"excess": "No Contribution", "price": 1077},
    "50": {"excess": "£50", "price": 982},
    "100": {"excess": "£100", "price": 855},
    "150": {"excess": "£150", "price": 824}
  }
}'::jsonb,
updated_at = now()
WHERE vehicle_type = 'PHEV';

-- Update EV plan pricing matrix
UPDATE special_vehicle_plans 
SET pricing_matrix = '{
  "12": {
    "0": {"excess": "No Contribution", "price": 34},
    "50": {"excess": "£50", "price": 31},
    "100": {"excess": "£100", "price": 27},
    "150": {"excess": "£150", "price": 27}
  },
  "24": {
    "0": {"excess": "No Contribution", "price": 408},
    "50": {"excess": "£50", "price": 372},
    "100": {"excess": "£100", "price": 324},
    "150": {"excess": "£150", "price": 312}
  },
  "36": {
    "0": {"excess": "No Contribution", "price": 1077},
    "50": {"excess": "£50", "price": 982},
    "100": {"excess": "£100", "price": 855},
    "150": {"excess": "£150", "price": 824}
  }
}'::jsonb,
updated_at = now()
WHERE vehicle_type = 'EV';

-- Update MOTORBIKE plan pricing matrix
UPDATE special_vehicle_plans 
SET pricing_matrix = '{
  "12": {
    "0": {"excess": "No Contribution", "price": 34},
    "50": {"excess": "£50", "price": 31},
    "100": {"excess": "£100", "price": 27},
    "150": {"excess": "£150", "price": 27}
  },
  "24": {
    "0": {"excess": "No Contribution", "price": 408},
    "50": {"excess": "£50", "price": 372},
    "100": {"excess": "£100", "price": 324},
    "150": {"excess": "£150", "price": 312}
  },
  "36": {
    "0": {"excess": "No Contribution", "price": 1077},
    "50": {"excess": "£50", "price": 982},
    "100": {"excess": "£100", "price": 855},
    "150": {"excess": "£150", "price": 824}
  }
}'::jsonb,
updated_at = now()
WHERE vehicle_type = 'MOTORBIKE';