-- Update all plans to use the unified pricing matrix
UPDATE plans 
SET 
  monthly_price = 367.00, -- Lowest price for display
  yearly_price = 697.00,  -- 2-year lowest price for display  
  three_yearly_price = 1047.00, -- 3-year lowest price for display
  pricing_matrix = '{
    "12": {
      "0_750": {"price": 467, "excess": "No Contribution", "claim_limit": "£750"},
      "0_1250": {"price": 497, "excess": "No Contribution", "claim_limit": "£1,250"},
      "0_2000": {"price": 587, "excess": "No Contribution", "claim_limit": "£2,000"},
      "50_750": {"price": 437, "excess": "£50", "claim_limit": "£750"},
      "50_1250": {"price": 457, "excess": "£50", "claim_limit": "£1,250"},
      "50_2000": {"price": 547, "excess": "£50", "claim_limit": "£2,000"},
      "100_750": {"price": 387, "excess": "£100", "claim_limit": "£750"},
      "100_1250": {"price": 417, "excess": "£100", "claim_limit": "£1,250"},
      "100_2000": {"price": 507, "excess": "£100", "claim_limit": "£2,000"},
      "150_750": {"price": 367, "excess": "£150", "claim_limit": "£750"},
      "150_1250": {"price": 387, "excess": "£150", "claim_limit": "£1,250"},
      "150_2000": {"price": 477, "excess": "£150", "claim_limit": "£2,000"}
    },
    "24": {
      "0_750": {"price": 897, "excess": "No Contribution", "claim_limit": "£750"},
      "0_1250": {"price": 937, "excess": "No Contribution", "claim_limit": "£1,250"},
      "0_2000": {"price": 1027, "excess": "No Contribution", "claim_limit": "£2,000"},
      "50_750": {"price": 827, "excess": "£50", "claim_limit": "£750"},
      "50_1250": {"price": 877, "excess": "£50", "claim_limit": "£1,250"},
      "50_2000": {"price": 957, "excess": "£50", "claim_limit": "£2,000"},
      "100_750": {"price": 737, "excess": "£100", "claim_limit": "£750"},
      "100_1250": {"price": 787, "excess": "£100", "claim_limit": "£1,250"},
      "100_2000": {"price": 877, "excess": "£100", "claim_limit": "£2,000"},
      "150_750": {"price": 697, "excess": "£150", "claim_limit": "£750"},
      "150_1250": {"price": 737, "excess": "£150", "claim_limit": "£1,250"},
      "150_2000": {"price": 827, "excess": "£150", "claim_limit": "£2,000"}
    },
    "36": {
      "0_750": {"price": 1347, "excess": "No Contribution", "claim_limit": "£750"},
      "0_1250": {"price": 1397, "excess": "No Contribution", "claim_limit": "£1,250"},
      "0_2000": {"price": 1497, "excess": "No Contribution", "claim_limit": "£2,000"},
      "50_750": {"price": 1247, "excess": "£50", "claim_limit": "£750"},
      "50_1250": {"price": 1297, "excess": "£50", "claim_limit": "£1,250"},
      "50_2000": {"price": 1397, "excess": "£50", "claim_limit": "£2,000"},
      "100_750": {"price": 1097, "excess": "£100", "claim_limit": "£750"},
      "100_1250": {"price": 1177, "excess": "£100", "claim_limit": "£1,250"},
      "100_2000": {"price": 1277, "excess": "£100", "claim_limit": "£2,000"},
      "150_750": {"price": 1047, "excess": "£150", "claim_limit": "£750"},
      "150_1250": {"price": 1097, "excess": "£150", "claim_limit": "£1,250"},
      "150_2000": {"price": 1197, "excess": "£150", "claim_limit": "£2,000"}
    }
  }'::jsonb,
  updated_at = now()
WHERE name IN ('Basic', 'Gold', 'Platinum');

-- Update special vehicle plans to use the same unified pricing matrix
UPDATE special_vehicle_plans 
SET 
  monthly_price = 367.00, -- Lowest price for display
  yearly_price = 697.00,  -- 2-year lowest price for display
  three_yearly_price = 1047.00, -- 3-year lowest price for display
  pricing_matrix = '{
    "12": {
      "0_750": {"price": 467, "excess": "No Contribution", "claim_limit": "£750"},
      "0_1250": {"price": 497, "excess": "No Contribution", "claim_limit": "£1,250"},
      "0_2000": {"price": 587, "excess": "No Contribution", "claim_limit": "£2,000"},
      "50_750": {"price": 437, "excess": "£50", "claim_limit": "£750"},
      "50_1250": {"price": 457, "excess": "£50", "claim_limit": "£1,250"},
      "50_2000": {"price": 547, "excess": "£50", "claim_limit": "£2,000"},
      "100_750": {"price": 387, "excess": "£100", "claim_limit": "£750"},
      "100_1250": {"price": 417, "excess": "£100", "claim_limit": "£1,250"},
      "100_2000": {"price": 507, "excess": "£100", "claim_limit": "£2,000"},
      "150_750": {"price": 367, "excess": "£150", "claim_limit": "£750"},
      "150_1250": {"price": 387, "excess": "£150", "claim_limit": "£1,250"},
      "150_2000": {"price": 477, "excess": "£150", "claim_limit": "£2,000"}
    },
    "24": {
      "0_750": {"price": 897, "excess": "No Contribution", "claim_limit": "£750"},
      "0_1250": {"price": 937, "excess": "No Contribution", "claim_limit": "£1,250"},
      "0_2000": {"price": 1027, "excess": "No Contribution", "claim_limit": "£2,000"},
      "50_750": {"price": 827, "excess": "£50", "claim_limit": "£750"},
      "50_1250": {"price": 877, "excess": "£50", "claim_limit": "£1,250"},
      "50_2000": {"price": 957, "excess": "£50", "claim_limit": "£2,000"},
      "100_750": {"price": 737, "excess": "£100", "claim_limit": "£750"},
      "100_1250": {"price": 787, "excess": "£100", "claim_limit": "£1,250"},
      "100_2000": {"price": 877, "excess": "£100", "claim_limit": "£2,000"},
      "150_750": {"price": 697, "excess": "£150", "claim_limit": "£750"},
      "150_1250": {"price": 737, "excess": "£150", "claim_limit": "£1,250"},
      "150_2000": {"price": 827, "excess": "£150", "claim_limit": "£2,000"}
    },
    "36": {
      "0_750": {"price": 1347, "excess": "No Contribution", "claim_limit": "£750"},
      "0_1250": {"price": 1397, "excess": "No Contribution", "claim_limit": "£1,250"},
      "0_2000": {"price": 1497, "excess": "No Contribution", "claim_limit": "£2,000"},
      "50_750": {"price": 1247, "excess": "£50", "claim_limit": "£750"},
      "50_1250": {"price": 1297, "excess": "£50", "claim_limit": "£1,250"},
      "50_2000": {"price": 1397, "excess": "£50", "claim_limit": "£2,000"},
      "100_750": {"price": 1097, "excess": "£100", "claim_limit": "£750"},
      "100_1250": {"price": 1177, "excess": "£100", "claim_limit": "£1,250"},
      "100_2000": {"price": 1277, "excess": "£100", "claim_limit": "£2,000"},
      "150_750": {"price": 1047, "excess": "£150", "claim_limit": "£750"},
      "150_1250": {"price": 1097, "excess": "£150", "claim_limit": "£1,250"},
      "150_2000": {"price": 1197, "excess": "£150", "claim_limit": "£2,000"}
    }
  }'::jsonb,
  updated_at = now()
WHERE vehicle_type IN ('PHEV', 'EV', 'MOTORBIKE');