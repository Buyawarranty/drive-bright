-- Soft-delete the duplicate customer record (the one created 34ms later)
UPDATE customers 
SET is_deleted = true, status = 'Cancelled'
WHERE id = '78ce5a10-73a7-45b7-ae5a-628b8291c4a4';

-- Soft-delete the duplicate policy
UPDATE customer_policies 
SET is_deleted = true, status = 'cancelled', deleted_at = now()
WHERE customer_id = '78ce5a10-73a7-45b7-ae5a-628b8291c4a4';
