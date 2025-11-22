-- Update all plans with the new standardized pricing matrix
UPDATE plans 
SET pricing_matrix = '{
  "12": {
    "750": {
      "0": {"excess": "No Contribution", "price": 467},
      "50": {"excess": "£50", "price": 437},
      "100": {"excess": "£100", "price": 387},
      "150": {"excess": "£150", "price": 367}
    },
    "1250": {
      "0": {"excess": "No Contribution", "price": 497},
      "50": {"excess": "£50", "price": 457},
      "100": {"excess": "£100", "price": 417},
      "150": {"excess": "£150", "price": 387}
    },
    "2000": {
      "0": {"excess": "No Contribution", "price": 587},
      "50": {"excess": "£50", "price": 547},
      "100": {"excess": "£100", "price": 507},
      "150": {"excess": "£150", "price": 477}
    }
  },
  "24": {
    "750": {
      "0": {"excess": "No Contribution", "price": 897},
      "50": {"excess": "£50", "price": 827},
      "100": {"excess": "£100", "price": 737},
      "150": {"excess": "£150", "price": 697}
    },
    "1250": {
      "0": {"excess": "No Contribution", "price": 937},
      "50": {"excess": "£50", "price": 877},
      "100": {"excess": "£100", "price": 787},
      "150": {"excess": "£150", "price": 737}
    },
    "2000": {
      "0": {"excess": "No Contribution", "price": 1027},
      "50": {"excess": "£50", "price": 957},
      "100": {"excess": "£100", "price": 877},
      "150": {"excess": "£150", "price": 827}
    }
  },
  "36": {
    "750": {
      "0": {"excess": "No Contribution", "price": 1347},
      "50": {"excess": "£50", "price": 1247},
      "100": {"excess": "£100", "price": 1097},
      "150": {"excess": "£150", "price": 1047}
    },
    "1250": {
      "0": {"excess": "No Contribution", "price": 1397},
      "50": {"excess": "£50", "price": 1297},
      "100": {"excess": "£100", "price": 1177},
      "150": {"excess": "£150", "price": 1097}
    },
    "2000": {
      "0": {"excess": "No Contribution", "price": 1497},
      "50": {"excess": "£50", "price": 1397},
      "100": {"excess": "£100", "price": 1277},
      "150": {"excess": "£150", "price": 1197}
    }
  }
}'::jsonb
WHERE is_active = true;

-- Update all special vehicle plans with the same pricing matrix
UPDATE special_vehicle_plans 
SET pricing_matrix = '{
  "12": {
    "0_750": {"claim_limit": "£750", "excess": "No Contribution", "price": 467},
    "50_750": {"claim_limit": "£750", "excess": "£50", "price": 437},
    "100_750": {"claim_limit": "£750", "excess": "£100", "price": 387},
    "150_750": {"claim_limit": "£750", "excess": "£150", "price": 367},
    "0_1250": {"claim_limit": "£1,250", "excess": "No Contribution", "price": 497},
    "50_1250": {"claim_limit": "£1,250", "excess": "£50", "price": 457},
    "100_1250": {"claim_limit": "£1,250", "excess": "£100", "price": 417},
    "150_1250": {"claim_limit": "£1,250", "excess": "£150", "price": 387},
    "0_2000": {"claim_limit": "£2,000", "excess": "No Contribution", "price": 587},
    "50_2000": {"claim_limit": "£2,000", "excess": "£50", "price": 547},
    "100_2000": {"claim_limit": "£2,000", "excess": "£100", "price": 507},
    "150_2000": {"claim_limit": "£2,000", "excess": "£150", "price": 477}
  },
  "24": {
    "0_750": {"claim_limit": "£750", "excess": "No Contribution", "price": 897},
    "50_750": {"claim_limit": "£750", "excess": "£50", "price": 827},
    "100_750": {"claim_limit": "£750", "excess": "£100", "price": 737},
    "150_750": {"claim_limit": "£750", "excess": "£150", "price": 697},
    "0_1250": {"claim_limit": "£1,250", "excess": "No Contribution", "price": 937},
    "50_1250": {"claim_limit": "£1,250", "excess": "£50", "price": 877},
    "100_1250": {"claim_limit": "£1,250", "excess": "£100", "price": 787},
    "150_1250": {"claim_limit": "£1,250", "excess": "£150", "price": 737},
    "0_2000": {"claim_limit": "£2,000", "excess": "No Contribution", "price": 1027},
    "50_2000": {"claim_limit": "£2,000", "excess": "£50", "price": 957},
    "100_2000": {"claim_limit": "£2,000", "excess": "£100", "price": 877},
    "150_2000": {"claim_limit": "£2,000", "excess": "£150", "price": 827}
  },
  "36": {
    "0_750": {"claim_limit": "£750", "excess": "No Contribution", "price": 1347},
    "50_750": {"claim_limit": "£750", "excess": "£50", "price": 1247},
    "100_750": {"claim_limit": "£750", "excess": "£100", "price": 1097},
    "150_750": {"claim_limit": "£750", "excess": "£150", "price": 1047},
    "0_1250": {"claim_limit": "£1,250", "excess": "No Contribution", "price": 1397},
    "50_1250": {"claim_limit": "£1,250", "excess": "£50", "price": 1297},
    "100_1250": {"claim_limit": "£1,250", "excess": "£100", "price": 1177},
    "150_1250": {"claim_limit": "£1,250", "excess": "£150", "price": 1097},
    "0_2000": {"claim_limit": "£2,000", "excess": "No Contribution", "price": 1497},
    "50_2000": {"claim_limit": "£2,000", "excess": "£50", "price": 1397},
    "100_2000": {"claim_limit": "£2,000", "excess": "£100", "price": 1277},
    "150_2000": {"claim_limit": "£2,000", "excess": "£150", "price": 1197}
  }
}'::jsonb
WHERE is_active = true;