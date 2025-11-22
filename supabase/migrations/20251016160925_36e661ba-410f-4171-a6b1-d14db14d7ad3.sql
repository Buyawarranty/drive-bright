-- Remove cancelled warranties (400446 and BAW-0210-400448) from sarabsingh@live.co.uk account
-- Keep only the newly created active warranty
DELETE FROM customer_policies 
WHERE email = 'sarabsingh@live.co.uk'
  AND status = 'cancelled'
  AND (warranty_number LIKE '%400446%' OR warranty_number = 'BAW-0210-400448');