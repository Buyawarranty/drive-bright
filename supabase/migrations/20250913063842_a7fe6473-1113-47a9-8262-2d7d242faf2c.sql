-- Remove existing Basic, Gold, Platinum plans
DELETE FROM plans WHERE name IN ('Basic', 'Gold', 'Platinum');

-- Insert single Premium plan with the exact pricing matrix
INSERT INTO plans (
  name,
  monthly_price,
  yearly_price,
  two_yearly_price,
  three_yearly_price,
  coverage,
  add_ons,
  pricing_matrix,
  is_active
) VALUES (
  'Premium',
  45.00,
  467.00,
  897.00,
  1347.00,
  '[
    "Mechanical breakdown cover",
    "Electrical breakdown cover", 
    "24/7 roadside assistance",
    "Recovery to nearest garage",
    "Parts and labour covered",
    "No age restrictions on vehicle",
    "Instant online quotes",
    "UK wide coverage"
  ]'::jsonb,
  '[
    {"name": "MOT Fee Cover", "price": 15, "description": "We will pay your MOT fee up to £75"},
    {"name": "Tyre Cover", "price": 25, "description": "Cover for accidental tyre damage"},
    {"name": "Wear & Tear Cover", "price": 35, "description": "Extended coverage for wear and tear items"},
    {"name": "European Cover", "price": 45, "description": "Extended coverage across Europe"},
    {"name": "Transfer Cover", "price": 25, "description": "Transfer your warranty to a new owner"}
  ]'::jsonb,
  '{
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
  }'::jsonb,
  true
);