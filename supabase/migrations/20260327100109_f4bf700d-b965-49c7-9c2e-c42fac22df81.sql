-- Make the 3 promo codes public with descriptions
UPDATE discount_codes SET is_public = true, public_description = 'Save £50 off your warranty plan' WHERE code = 'BUS';
UPDATE discount_codes SET is_public = true, public_description = 'Save 5% off your warranty plan' WHERE code = '5PERCENTSAVENOW';
UPDATE discount_codes SET is_public = true, public_description = 'Save £25 off your warranty plan' WHERE code = 'SAVE25NOW';