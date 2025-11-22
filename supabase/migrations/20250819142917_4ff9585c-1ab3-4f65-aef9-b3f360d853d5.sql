-- Update Basic plan pricing matrix
UPDATE plans 
SET pricing_matrix = '{
  "monthly": {
    "0": {"price": 31, "laborCost": 35},
    "50": {"price": 29, "laborCost": 35},
    "100": {"price": 25, "laborCost": 35},
    "150": {"price": 23, "laborCost": 35}
  },
  "yearly": {
    "0": {"price": 31, "laborCost": 35},
    "50": {"price": 29, "laborCost": 35},
    "100": {"price": 25, "laborCost": 35},
    "150": {"price": 23, "laborCost": 35}
  },
  "24": {
    "0": {"price": 56, "laborCost": 35},
    "50": {"price": 52, "laborCost": 35},
    "100": {"price": 45, "laborCost": 35},
    "150": {"price": 41, "laborCost": 35}
  },
  "36": {
    "0": {"price": 82, "laborCost": 35},
    "50": {"price": 77, "laborCost": 35},
    "100": {"price": 66, "laborCost": 35},
    "150": {"price": 61, "laborCost": 35}
  }
}'
WHERE name = 'Basic';

-- Update Gold plan pricing matrix
UPDATE plans 
SET pricing_matrix = '{
  "monthly": {
    "0": {"price": 34, "laborCost": 75},
    "50": {"price": 31, "laborCost": 75},
    "100": {"price": 27, "laborCost": 75},
    "150": {"price": 27, "laborCost": 75}
  },
  "yearly": {
    "0": {"price": 34, "laborCost": 75},
    "50": {"price": 31, "laborCost": 75},
    "100": {"price": 27, "laborCost": 75},
    "150": {"price": 27, "laborCost": 75}
  },
  "24": {
    "0": {"price": 61, "laborCost": 75},
    "50": {"price": 56, "laborCost": 75},
    "100": {"price": 49, "laborCost": 75},
    "150": {"price": 47, "laborCost": 75}
  },
  "36": {
    "0": {"price": 90, "laborCost": 75},
    "50": {"price": 82, "laborCost": 75},
    "100": {"price": 71, "laborCost": 75},
    "150": {"price": 69, "laborCost": 75}
  }
}'
WHERE name = 'Gold';

-- Update Platinum plan pricing matrix
UPDATE plans 
SET pricing_matrix = '{
  "monthly": {
    "0": {"price": 36, "laborCost": 100},
    "50": {"price": 33, "laborCost": 100},
    "100": {"price": 29, "laborCost": 100},
    "150": {"price": 27, "laborCost": 100}
  },
  "yearly": {
    "0": {"price": 36, "laborCost": 100},
    "50": {"price": 33, "laborCost": 100},
    "100": {"price": 29, "laborCost": 100},
    "150": {"price": 27, "laborCost": 100}
  },
  "24": {
    "0": {"price": 65, "laborCost": 100},
    "50": {"price": 59, "laborCost": 100},
    "100": {"price": 52, "laborCost": 100},
    "150": {"price": 49, "laborCost": 100}
  },
  "36": {
    "0": {"price": 96, "laborCost": 100},
    "50": {"price": 87, "laborCost": 100},
    "100": {"price": 77, "laborCost": 100},
    "150": {"price": 71, "laborCost": 100}
  }
}'
WHERE name = 'Platinum';