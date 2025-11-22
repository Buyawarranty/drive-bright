-- Update pricing matrix to match the complete pricing table
-- Basic plan: £750 claim limit
-- Gold plan: £1,250 claim limit 
-- Platinum plan: £2,000 claim limit

UPDATE plans 
SET 
  pricing_matrix = jsonb_build_object(
    '12', jsonb_build_object(
      '0', jsonb_build_object('price', 
        CASE 
          WHEN name = 'Basic' THEN 467
          WHEN name = 'Gold' THEN 497
          WHEN name = 'Platinum' THEN 587
        END, 'excess', 'No Contribution'),
      '50', jsonb_build_object('price', 
        CASE 
          WHEN name = 'Basic' THEN 437
          WHEN name = 'Gold' THEN 457
          WHEN name = 'Platinum' THEN 547
        END, 'excess', '£50'),
      '100', jsonb_build_object('price', 
        CASE 
          WHEN name = 'Basic' THEN 387
          WHEN name = 'Gold' THEN 417
          WHEN name = 'Platinum' THEN 507
        END, 'excess', '£100'),
      '150', jsonb_build_object('price', 
        CASE 
          WHEN name = 'Basic' THEN 367
          WHEN name = 'Gold' THEN 387
          WHEN name = 'Platinum' THEN 477
        END, 'excess', '£150')
    ),
    '24', jsonb_build_object(
      '0', jsonb_build_object('price', 
        CASE 
          WHEN name = 'Basic' THEN 897
          WHEN name = 'Gold' THEN 937
          WHEN name = 'Platinum' THEN 1027
        END, 'excess', 'No Contribution'),
      '50', jsonb_build_object('price', 
        CASE 
          WHEN name = 'Basic' THEN 827
          WHEN name = 'Gold' THEN 877
          WHEN name = 'Platinum' THEN 957
        END, 'excess', '£50'),
      '100', jsonb_build_object('price', 
        CASE 
          WHEN name = 'Basic' THEN 737
          WHEN name = 'Gold' THEN 787
          WHEN name = 'Platinum' THEN 877
        END, 'excess', '£100'),
      '150', jsonb_build_object('price', 
        CASE 
          WHEN name = 'Basic' THEN 697
          WHEN name = 'Gold' THEN 737
          WHEN name = 'Platinum' THEN 827
        END, 'excess', '£150')
    ),
    '36', jsonb_build_object(
      '0', jsonb_build_object('price', 
        CASE 
          WHEN name = 'Basic' THEN 1347
          WHEN name = 'Gold' THEN 1397
          WHEN name = 'Platinum' THEN 1497
        END, 'excess', 'No Contribution'),
      '50', jsonb_build_object('price', 
        CASE 
          WHEN name = 'Basic' THEN 1247
          WHEN name = 'Gold' THEN 1297
          WHEN name = 'Platinum' THEN 1397
        END, 'excess', '£50'),
      '100', jsonb_build_object('price', 
        CASE 
          WHEN name = 'Basic' THEN 1097
          WHEN name = 'Gold' THEN 1177
          WHEN name = 'Platinum' THEN 1277
        END, 'excess', '£100'),
      '150', jsonb_build_object('price', 
        CASE 
          WHEN name = 'Basic' THEN 1047
          WHEN name = 'Gold' THEN 1097
          WHEN name = 'Platinum' THEN 1197
        END, 'excess', '£150')
    )
  ),
  updated_at = now()
WHERE name IN ('Basic', 'Gold', 'Platinum');