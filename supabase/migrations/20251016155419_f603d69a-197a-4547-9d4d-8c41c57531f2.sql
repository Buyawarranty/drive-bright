-- Soft delete policies with warranty numbers BAW-0210-400449 and BAW-0210-400448 for customer Sarabsingh@live.co.uk
UPDATE customer_policies 
SET 
  is_deleted = true,
  deleted_at = now(),
  status = 'cancelled'
WHERE warranty_number IN ('BAW-0210-400449', 'BAW-0210-400448')
  AND email = 'Sarabsingh@live.co.uk';