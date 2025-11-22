-- Add pricing matrix columns to plans table to support voluntary excess discounts
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS pricing_matrix JSONB DEFAULT '{}'::jsonb;

-- Add pricing matrix columns to special_vehicle_plans table  
ALTER TABLE public.special_vehicle_plans ADD COLUMN IF NOT EXISTS pricing_matrix JSONB DEFAULT '{}'::jsonb;

-- Populate the plans table with the hardcoded pricing data from the components
UPDATE public.plans SET pricing_matrix = '{
  "yearly": {
    "0": {"monthly": 31, "total": 372, "save": 0},
    "50": {"monthly": 29, "total": 348, "save": 0}, 
    "100": {"monthly": 25, "total": 300, "save": 0},
    "150": {"monthly": 23, "total": 276, "save": 0},
    "200": {"monthly": 20, "total": 240, "save": 0}
  },
  "two_yearly": {
    "0": {"monthly": 56, "total": 670, "save": 74},
    "50": {"monthly": 52, "total": 626, "save": 70},
    "100": {"monthly": 45, "total": 540, "save": 60}, 
    "150": {"monthly": 41, "total": 497, "save": 55},
    "200": {"monthly": 38, "total": 456, "save": 50}
  },
  "three_yearly": {
    "0": {"monthly": 82, "total": 982, "save": 134},
    "50": {"monthly": 77, "total": 919, "save": 125},
    "100": {"monthly": 66, "total": 792, "save": 108},
    "150": {"monthly": 61, "total": 729, "save": 99}, 
    "200": {"monthly": 56, "total": 672, "save": 92}
  }
}'::jsonb WHERE name = 'Basic';

UPDATE public.plans SET pricing_matrix = '{
  "yearly": {
    "0": {"monthly": 34, "total": 408, "save": 0},
    "50": {"monthly": 31, "total": 372, "save": 0},
    "100": {"monthly": 27, "total": 324, "save": 0},
    "150": {"monthly": 26, "total": 312, "save": 0},
    "200": {"monthly": 23, "total": 276, "save": 0}
  },
  "two_yearly": {
    "0": {"monthly": 61, "total": 734, "save": 82},
    "50": {"monthly": 56, "total": 670, "save": 74},
    "100": {"monthly": 49, "total": 583, "save": 65},
    "150": {"monthly": 47, "total": 562, "save": 62},
    "200": {"monthly": 44, "total": 528, "save": 58}
  },
  "three_yearly": {
    "0": {"monthly": 90, "total": 1077, "save": 147},
    "50": {"monthly": 82, "total": 982, "save": 134},
    "100": {"monthly": 71, "total": 855, "save": 117},
    "150": {"monthly": 69, "total": 824, "save": 112},
    "200": {"monthly": 66, "total": 792, "save": 108}
  }
}'::jsonb WHERE name = 'Gold';

UPDATE public.plans SET pricing_matrix = '{
  "yearly": {
    "0": {"monthly": 36, "total": 437, "save": 0},
    "50": {"monthly": 32, "total": 384, "save": 0},
    "100": {"monthly": 29, "total": 348, "save": 0},
    "150": {"monthly": 27, "total": 324, "save": 0},
    "200": {"monthly": 25, "total": 300, "save": 0}
  },
  "two_yearly": {
    "0": {"monthly": 65, "total": 786, "save": 87},
    "50": {"monthly": 58, "total": 691, "save": 77},
    "100": {"monthly": 52, "total": 626, "save": 70},
    "150": {"monthly": 49, "total": 583, "save": 65},
    "200": {"monthly": 46, "total": 552, "save": 61}
  },
  "three_yearly": {
    "0": {"monthly": 96, "total": 1153, "save": 157},
    "50": {"monthly": 84, "total": 1014, "save": 138},
    "100": {"monthly": 77, "total": 919, "save": 125},
    "150": {"monthly": 71, "total": 855, "save": 117},
    "200": {"monthly": 69, "total": 828, "save": 113}
  }
}'::jsonb WHERE name = 'Platinum';

-- Populate special vehicle plans with Gold plan pricing (as specified in SpecialVehiclePricing component)
UPDATE public.special_vehicle_plans SET pricing_matrix = '{
  "yearly": {
    "0": {"monthly": 34},
    "50": {"monthly": 31},
    "100": {"monthly": 27}, 
    "150": {"monthly": 26},
    "200": {"monthly": 23}
  },
  "two_yearly": {
    "0": {"monthly": 61},
    "50": {"monthly": 56},
    "100": {"monthly": 49},
    "150": {"monthly": 47},
    "200": {"monthly": 44}
  },
  "three_yearly": {
    "0": {"monthly": 90},
    "50": {"monthly": 82},
    "100": {"monthly": 71},
    "150": {"monthly": 69}, 
    "200": {"monthly": 66}
  }
}'::jsonb;