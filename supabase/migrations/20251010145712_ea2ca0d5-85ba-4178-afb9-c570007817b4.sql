-- Update pricing matrix for all plans (Basic, Gold, Platinum) with new structure including claim limits
UPDATE plans 
SET 
  monthly_price = 537.00,  -- Base price for 1250 claim limit, 50 excess
  yearly_price = 1037.00,
  three_yearly_price = 1517.00,
  pricing_matrix = '{
    "12": {
      "0": {
        "750": {"price": 547, "excess": "No Contribution", "claimLimit": 750},
        "1250": {"price": 587, "excess": "No Contribution", "claimLimit": 1250},
        "2000": {"price": 697, "excess": "No Contribution", "claimLimit": 2000}
      },
      "50": {
        "750": {"price": 517, "excess": "£50", "claimLimit": 750},
        "1250": {"price": 537, "excess": "£50", "claimLimit": 1250},
        "2000": {"price": 647, "excess": "£50", "claimLimit": 2000}
      },
      "100": {
        "750": {"price": 457, "excess": "£100", "claimLimit": 750},
        "1250": {"price": 497, "excess": "£100", "claimLimit": 1250},
        "2000": {"price": 597, "excess": "£100", "claimLimit": 2000}
      },
      "150": {
        "750": {"price": 427, "excess": "£150", "claimLimit": 750},
        "1250": {"price": 457, "excess": "£150", "claimLimit": 1250},
        "2000": {"price": 567, "excess": "£150", "claimLimit": 2000}
      }
    },
    "24": {
      "0": {
        "750": {"price": 1057, "excess": "No Contribution", "claimLimit": 750},
        "1250": {"price": 1097, "excess": "No Contribution", "claimLimit": 1250},
        "2000": {"price": 1207, "excess": "No Contribution", "claimLimit": 2000}
      },
      "50": {
        "750": {"price": 967, "excess": "£50", "claimLimit": 750},
        "1250": {"price": 1037, "excess": "£50", "claimLimit": 1250},
        "2000": {"price": 1127, "excess": "£50", "claimLimit": 2000}
      },
      "100": {
        "750": {"price": 867, "excess": "£100", "claimLimit": 750},
        "1250": {"price": 927, "excess": "£100", "claimLimit": 1250},
        "2000": {"price": 1037, "excess": "£100", "claimLimit": 2000}
      },
      "150": {
        "750": {"price": 817, "excess": "£150", "claimLimit": 750},
        "1250": {"price": 867, "excess": "£150", "claimLimit": 1250},
        "2000": {"price": 967, "excess": "£150", "claimLimit": 2000}
      }
    },
    "36": {
      "0": {
        "750": {"price": 1587, "excess": "No Contribution", "claimLimit": 750},
        "1250": {"price": 1637, "excess": "No Contribution", "claimLimit": 1250},
        "2000": {"price": 1757, "excess": "No Contribution", "claimLimit": 2000}
      },
      "50": {
        "750": {"price": 1467, "excess": "£50", "claimLimit": 750},
        "1250": {"price": 1517, "excess": "£50", "claimLimit": 1250},
        "2000": {"price": 1637, "excess": "£50", "claimLimit": 2000}
      },
      "100": {
        "750": {"price": 1287, "excess": "£100", "claimLimit": 750},
        "1250": {"price": 1387, "excess": "£100", "claimLimit": 1250},
        "2000": {"price": 1507, "excess": "£100", "claimLimit": 2000}
      },
      "150": {
        "750": {"price": 1237, "excess": "£150", "claimLimit": 750},
        "1250": {"price": 1287, "excess": "£150", "claimLimit": 1250},
        "2000": {"price": 1407, "excess": "£150", "claimLimit": 2000}
      }
    }
  }'::jsonb,
  updated_at = now()
WHERE name IN ('Basic', 'Gold', 'Platinum');

-- Update pricing matrix for all special vehicle plans (PHEV, EV, MOTORBIKE, VAN) with new structure
UPDATE special_vehicle_plans 
SET 
  monthly_price = 537.00,  -- Base price for 1250 claim limit, 50 excess
  yearly_price = 1037.00,
  three_yearly_price = 1517.00,
  pricing_matrix = '{
    "12": {
      "0": {
        "750": {"price": 547, "excess": "No Contribution", "claimLimit": 750},
        "1250": {"price": 587, "excess": "No Contribution", "claimLimit": 1250},
        "2000": {"price": 697, "excess": "No Contribution", "claimLimit": 2000}
      },
      "50": {
        "750": {"price": 517, "excess": "£50", "claimLimit": 750},
        "1250": {"price": 537, "excess": "£50", "claimLimit": 1250},
        "2000": {"price": 647, "excess": "£50", "claimLimit": 2000}
      },
      "100": {
        "750": {"price": 457, "excess": "£100", "claimLimit": 750},
        "1250": {"price": 497, "excess": "£100", "claimLimit": 1250},
        "2000": {"price": 597, "excess": "£100", "claimLimit": 2000}
      },
      "150": {
        "750": {"price": 427, "excess": "£150", "claimLimit": 750},
        "1250": {"price": 457, "excess": "£150", "claimLimit": 1250},
        "2000": {"price": 567, "excess": "£150", "claimLimit": 2000}
      }
    },
    "24": {
      "0": {
        "750": {"price": 1057, "excess": "No Contribution", "claimLimit": 750},
        "1250": {"price": 1097, "excess": "No Contribution", "claimLimit": 1250},
        "2000": {"price": 1207, "excess": "No Contribution", "claimLimit": 2000}
      },
      "50": {
        "750": {"price": 967, "excess": "£50", "claimLimit": 750},
        "1250": {"price": 1037, "excess": "£50", "claimLimit": 1250},
        "2000": {"price": 1127, "excess": "£50", "claimLimit": 2000}
      },
      "100": {
        "750": {"price": 867, "excess": "£100", "claimLimit": 750},
        "1250": {"price": 927, "excess": "£100", "claimLimit": 1250},
        "2000": {"price": 1037, "excess": "£100", "claimLimit": 2000}
      },
      "150": {
        "750": {"price": 817, "excess": "£150", "claimLimit": 750},
        "1250": {"price": 867, "excess": "£150", "claimLimit": 1250},
        "2000": {"price": 967, "excess": "£150", "claimLimit": 2000}
      }
    },
    "36": {
      "0": {
        "750": {"price": 1587, "excess": "No Contribution", "claimLimit": 750},
        "1250": {"price": 1637, "excess": "No Contribution", "claimLimit": 1250},
        "2000": {"price": 1757, "excess": "No Contribution", "claimLimit": 2000}
      },
      "50": {
        "750": {"price": 1467, "excess": "£50", "claimLimit": 750},
        "1250": {"price": 1517, "excess": "£50", "claimLimit": 1250},
        "2000": {"price": 1637, "excess": "£50", "claimLimit": 2000}
      },
      "100": {
        "750": {"price": 1287, "excess": "£100", "claimLimit": 750},
        "1250": {"price": 1387, "excess": "£100", "claimLimit": 1250},
        "2000": {"price": 1507, "excess": "£100", "claimLimit": 2000}
      },
      "150": {
        "750": {"price": 1237, "excess": "£150", "claimLimit": 750},
        "1250": {"price": 1287, "excess": "£150", "claimLimit": 1250},
        "2000": {"price": 1407, "excess": "£150", "claimLimit": 2000}
      }
    }
  }'::jsonb,
  updated_at = now()
WHERE vehicle_type IN ('PHEV', 'EV', 'MOTORBIKE', 'VAN');