-- Create or update special vehicle plans for CAR, VAN, SUV, MOTORBIKE with unified pricing matrix
DO $$
DECLARE
  v_matrix jsonb := '{
    "12": {
      "750": {
        "0": {"price": 467, "excess": "No Contribution"},
        "50": {"price": 437, "excess": "£50"},
        "100": {"price": 387, "excess": "£100"},
        "150": {"price": 367, "excess": "£150"}
      },
      "1250": {
        "0": {"price": 497, "excess": "No Contribution"},
        "50": {"price": 457, "excess": "£50"},
        "100": {"price": 417, "excess": "£100"},
        "150": {"price": 387, "excess": "£150"}
      },
      "2000": {
        "0": {"price": 587, "excess": "No Contribution"},
        "50": {"price": 547, "excess": "£50"},
        "100": {"price": 507, "excess": "£100"},
        "150": {"price": 477, "excess": "£150"}
      }
    },
    "24": {
      "750": {
        "0": {"price": 897, "excess": "No Contribution"},
        "50": {"price": 827, "excess": "£50"},
        "100": {"price": 737, "excess": "£100"},
        "150": {"price": 697, "excess": "£150"}
      },
      "1250": {
        "0": {"price": 937, "excess": "No Contribution"},
        "50": {"price": 877, "excess": "£50"},
        "100": {"price": 787, "excess": "£100"},
        "150": {"price": 737, "excess": "£150"}
      },
      "2000": {
        "0": {"price": 1027, "excess": "No Contribution"},
        "50": {"price": 957, "excess": "£50"},
        "100": {"price": 877, "excess": "£100"},
        "150": {"price": 827, "excess": "£150"}
      }
    },
    "36": {
      "750": {
        "0": {"price": 1347, "excess": "No Contribution"},
        "50": {"price": 1247, "excess": "£50"},
        "100": {"price": 1097, "excess": "£100"},
        "150": {"price": 1047, "excess": "£150"}
      },
      "1250": {
        "0": {"price": 1397, "excess": "No Contribution"},
        "50": {"price": 1297, "excess": "£50"},
        "100": {"price": 1177, "excess": "£100"},
        "150": {"price": 1097, "excess": "£150"}
      },
      "2000": {
        "0": {"price": 1497, "excess": "No Contribution"},
        "50": {"price": 1397, "excess": "£50"},
        "100": {"price": 1277, "excess": "£100"},
        "150": {"price": 1197, "excess": "£150"}
      }
    }
  }'::jsonb;
  v_coverage jsonb := '[
    "Mechanical & electrical breakdown cover",
    "24/7 roadside assistance",
    "Recovery to nearest garage",
    "Parts and labour covered",
    "Instant online quotes",
    "UK wide coverage"
  ]'::jsonb;
BEGIN
  -- Upsert helper for given vehicle type
  PERFORM 1;
END $$;

-- Use a single UPSERT statement per vehicle type to avoid duplicates
INSERT INTO public.special_vehicle_plans (
  name, vehicle_type, monthly_price, yearly_price, two_yearly_price, three_yearly_price,
  coverage, pricing_matrix, is_active
)
VALUES
  ('Premium Car Plan', 'CAR', 45.00, 467.00, 897.00, 1347.00, '["Mechanical & electrical breakdown cover","24/7 roadside assistance","Recovery to nearest garage","Parts and labour covered","Instant online quotes","UK wide coverage"]'::jsonb, (
    SELECT '{
      "12": {"750": {"0": {"price": 467, "excess": "No Contribution"}, "50": {"price": 437, "excess": "£50"}, "100": {"price": 387, "excess": "£100"}, "150": {"price": 367, "excess": "£150"}},
               "1250": {"0": {"price": 497, "excess": "No Contribution"}, "50": {"price": 457, "excess": "£50"}, "100": {"price": 417, "excess": "£100"}, "150": {"price": 387, "excess": "£150"}},
               "2000": {"0": {"price": 587, "excess": "No Contribution"}, "50": {"price": 547, "excess": "£50"}, "100": {"price": 507, "excess": "£100"}, "150": {"price": 477, "excess": "£150"}}},
      "24": {"750": {"0": {"price": 897, "excess": "No Contribution"}, "50": {"price": 827, "excess": "£50"}, "100": {"price": 737, "excess": "£100"}, "150": {"price": 697, "excess": "£150"}},
               "1250": {"0": {"price": 937, "excess": "No Contribution"}, "50": {"price": 877, "excess": "£50"}, "100": {"price": 787, "excess": "£100"}, "150": {"price": 737, "excess": "£150"}},
               "2000": {"0": {"price": 1027, "excess": "No Contribution"}, "50": {"price": 957, "excess": "£50"}, "100": {"price": 877, "excess": "£100"}, "150": {"price": 827, "excess": "£150"}}},
      "36": {"750": {"0": {"price": 1347, "excess": "No Contribution"}, "50": {"price": 1247, "excess": "£50"}, "100": {"price": 1097, "excess": "£100"}, "150": {"price": 1047, "excess": "£150"}},
               "1250": {"0": {"price": 1397, "excess": "No Contribution"}, "50": {"price": 1297, "excess": "£50"}, "100": {"price": 1177, "excess": "£100"}, "150": {"price": 1097, "excess": "£150"}},
               "2000": {"0": {"price": 1497, "excess": "No Contribution"}, "50": {"price": 1397, "excess": "£50"}, "100": {"price": 1277, "excess": "£100"}, "150": {"price": 1197, "excess": "£150"}}}
    }'::jsonb), true),
  ('Premium Van Plan', 'VAN', 45.00, 467.00, 897.00, 1347.00, '["Mechanical & electrical breakdown cover","24/7 roadside assistance","Recovery to nearest garage","Parts and labour covered","Instant online quotes","UK wide coverage"]'::jsonb, (
    SELECT '{
      "12": {"750": {"0": {"price": 467, "excess": "No Contribution"}, "50": {"price": 437, "excess": "£50"}, "100": {"price": 387, "excess": "£100"}, "150": {"price": 367, "excess": "£150"}},
               "1250": {"0": {"price": 497, "excess": "No Contribution"}, "50": {"price": 457, "excess": "£50"}, "100": {"price": 417, "excess": "£100"}, "150": {"price": 387, "excess": "£150"}},
               "2000": {"0": {"price": 587, "excess": "No Contribution"}, "50": {"price": 547, "excess": "£50"}, "100": {"price": 507, "excess": "£100"}, "150": {"price": 477, "excess": "£150"}}},
      "24": {"750": {"0": {"price": 897, "excess": "No Contribution"}, "50": {"price": 827, "excess": "£50"}, "100": {"price": 737, "excess": "£100"}, "150": {"price": 697, "excess": "£150"}},
               "1250": {"0": {"price": 937, "excess": "No Contribution"}, "50": {"price": 877, "excess": "£50"}, "100": {"price": 787, "excess": "£100"}, "150": {"price": 737, "excess": "£150"}},
               "2000": {"0": {"price": 1027, "excess": "No Contribution"}, "50": {"price": 957, "excess": "£50"}, "100": {"price": 877, "excess": "£100"}, "150": {"price": 827, "excess": "£150"}}},
      "36": {"750": {"0": {"price": 1347, "excess": "No Contribution"}, "50": {"price": 1247, "excess": "£50"}, "100": {"price": 1097, "excess": "£100"}, "150": {"price": 1047, "excess": "£150"}},
               "1250": {"0": {"price": 1397, "excess": "No Contribution"}, "50": {"price": 1297, "excess": "£50"}, "100": {"price": 1177, "excess": "£100"}, "150": {"price": 1097, "excess": "£150"}},
               "2000": {"0": {"price": 1497, "excess": "No Contribution"}, "50": {"price": 1397, "excess": "£50"}, "100": {"price": 1277, "excess": "£100"}, "150": {"price": 1197, "excess": "£150"}}}
    }'::jsonb), true),
  ('Premium SUV Plan', 'SUV', 45.00, 467.00, 897.00, 1347.00, '["Mechanical & electrical breakdown cover","24/7 roadside assistance","Recovery to nearest garage","Parts and labour covered","Instant online quotes","UK wide coverage"]'::jsonb, (
    SELECT '{
      "12": {"750": {"0": {"price": 467, "excess": "No Contribution"}, "50": {"price": 437, "excess": "£50"}, "100": {"price": 387, "excess": "£100"}, "150": {"price": 367, "excess": "£150"}},
               "1250": {"0": {"price": 497, "excess": "No Contribution"}, "50": {"price": 457, "excess": "£50"}, "100": {"price": 417, "excess": "£100"}, "150": {"price": 387, "excess": "£150"}},
               "2000": {"0": {"price": 587, "excess": "No Contribution"}, "50": {"price": 547, "excess": "£50"}, "100": {"price": 507, "excess": "£100"}, "150": {"price": 477, "excess": "£150"}}},
      "24": {"750": {"0": {"price": 897, "excess": "No Contribution"}, "50": {"price": 827, "excess": "£50"}, "100": {"price": 737, "excess": "£100"}, "150": {"price": 697, "excess": "£150"}},
               "1250": {"0": {"price": 937, "excess": "No Contribution"}, "50": {"price": 877, "excess": "£50"}, "100": {"price": 787, "excess": "£100"}, "150": {"price": 737, "excess": "£150"}},
               "2000": {"0": {"price": 1027, "excess": "No Contribution"}, "50": {"price": 957, "excess": "£50"}, "100": {"price": 877, "excess": "£100"}, "150": {"price": 827, "excess": "£150"}}},
      "36": {"750": {"0": {"price": 1347, "excess": "No Contribution"}, "50": {"price": 1247, "excess": "£50"}, "100": {"price": 1097, "excess": "£100"}, "150": {"price": 1047, "excess": "£150"}},
               "1250": {"0": {"price": 1397, "excess": "No Contribution"}, "50": {"price": 1297, "excess": "£50"}, "100": {"price": 1177, "excess": "£100"}, "150": {"price": 1097, "excess": "£150"}},
               "2000": {"0": {"price": 1497, "excess": "No Contribution"}, "50": {"price": 1397, "excess": "£50"}, "100": {"price": 1277, "excess": "£100"}, "150": {"price": 1197, "excess": "£150"}}}
    }'::jsonb), true),
  ('Premium Motorbike Plan', 'MOTORBIKE', 45.00, 467.00, 897.00, 1347.00, '["Mechanical & electrical breakdown cover","24/7 roadside assistance","Recovery to nearest garage","Parts and labour covered","Instant online quotes","UK wide coverage"]'::jsonb, (
    SELECT '{
      "12": {"750": {"0": {"price": 467, "excess": "No Contribution"}, "50": {"price": 437, "excess": "£50"}, "100": {"price": 387, "excess": "£100"}, "150": {"price": 367, "excess": "£150"}},
               "1250": {"0": {"price": 497, "excess": "No Contribution"}, "50": {"price": 457, "excess": "£50"}, "100": {"price": 417, "excess": "£100"}, "150": {"price": 387, "excess": "£150"}},
               "2000": {"0": {"price": 587, "excess": "No Contribution"}, "50": {"price": 547, "excess": "£50"}, "100": {"price": 507, "excess": "£100"}, "150": {"price": 477, "excess": "£150"}}},
      "24": {"750": {"0": {"price": 897, "excess": "No Contribution"}, "50": {"price": 827, "excess": "£50"}, "100": {"price": 737, "excess": "£100"}, "150": {"price": 697, "excess": "£150"}},
               "1250": {"0": {"price": 937, "excess": "No Contribution"}, "50": {"price": 877, "excess": "£50"}, "100": {"price": 787, "excess": "£100"}, "150": {"price": 737, "excess": "£150"}},
               "2000": {"0": {"price": 1027, "excess": "No Contribution"}, "50": {"price": 957, "excess": "£50"}, "100": {"price": 877, "excess": "£100"}, "150": {"price": 827, "excess": "£150"}}},
      "36": {"750": {"0": {"price": 1347, "excess": "No Contribution"}, "50": {"price": 1247, "excess": "£50"}, "100": {"price": 1097, "excess": "£100"}, "150": {"price": 1047, "excess": "£150"}},
               "1250": {"0": {"price": 1397, "excess": "No Contribution"}, "50": {"price": 1297, "excess": "£50"}, "100": {"price": 1177, "excess": "£100"}, "150": {"price": 1097, "excess": "£150"}},
               "2000": {"0": {"price": 1497, "excess": "No Contribution"}, "50": {"price": 1397, "excess": "£50"}, "100": {"price": 1277, "excess": "£100"}, "150": {"price": 1197, "excess": "£150"}}}
    }'::jsonb), true)
ON CONFLICT (vehicle_type)
DO UPDATE SET
  name = EXCLUDED.name,
  monthly_price = EXCLUDED.monthly_price,
  yearly_price = EXCLUDED.yearly_price,
  two_yearly_price = EXCLUDED.two_yearly_price,
  three_yearly_price = EXCLUDED.three_yearly_price,
  coverage = EXCLUDED.coverage,
  pricing_matrix = EXCLUDED.pricing_matrix,
  is_active = true,
  updated_at = now();