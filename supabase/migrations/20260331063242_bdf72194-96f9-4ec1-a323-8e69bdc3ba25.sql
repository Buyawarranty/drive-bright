
-- Fix PJ23JWC customer record with correct details
UPDATE customers 
SET first_name = 'Barry',
    last_name = 'Hitchen',
    building_number = 'Beechwood House',
    street = 'Stockton Road, South Kilvington',
    town = 'North Yorkshire',
    postcode = 'YO72LZ',
    country = 'United Kingdom',
    updated_at = now()
WHERE id = 'c195e8dc-2180-4c16-bddc-51acb1d3fd6a';

-- Fix BA19UCD policy address
UPDATE customer_policies 
SET address = jsonb_build_object(
    'building_number', 'Beechwood House',
    'street', 'Stockton Road, South Kilvington',
    'town', 'North Yorkshire',
    'postcode', 'YO72LZ',
    'county', '',
    'country', 'United Kingdom'
),
updated_at = now()
WHERE id = '5143697b-fa48-47bc-9b11-28123058e82f';

-- Fix PJ23JWC policy address
UPDATE customer_policies 
SET address = jsonb_build_object(
    'building_number', 'Beechwood House',
    'street', 'Stockton Road, South Kilvington',
    'town', 'North Yorkshire',
    'postcode', 'YO72LZ',
    'county', '',
    'country', 'United Kingdom'
),
updated_at = now()
WHERE id = '41067288-975b-4a00-abfd-2638d2849cb1';
