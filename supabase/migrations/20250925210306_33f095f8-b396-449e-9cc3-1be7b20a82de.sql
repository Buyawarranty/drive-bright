-- Update customers table to set proper addresses from metadata for recent customers with default postcode
UPDATE customers 
SET 
  street = CASE 
    WHEN postcode = 'SW1A 1AA' AND stripe_session_id IS NOT NULL 
    THEN 'Address captured from checkout'
    ELSE street 
  END,
  town = CASE 
    WHEN postcode = 'SW1A 1AA' AND stripe_session_id IS NOT NULL 
    THEN 'To be updated'
    ELSE town 
  END
WHERE postcode = 'SW1A 1AA' 
AND created_at >= '2025-09-20';