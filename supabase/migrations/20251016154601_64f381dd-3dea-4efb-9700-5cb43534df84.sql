-- Soft delete policy with warranty number containing 400447 for customer Sarabsingh@live.co.uk
UPDATE customer_policies 
SET 
  is_deleted = true,
  deleted_at = now(),
  status = 'cancelled'
WHERE warranty_number LIKE '%400447%'
  AND email = 'Sarabsingh@live.co.uk';