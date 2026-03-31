-- Restore PJ23JWC customer record as separate order in admin
UPDATE customers 
SET is_deleted = false, 
    deleted_at = NULL, 
    deleted_by = NULL, 
    status = 'Active'
WHERE id = 'c195e8dc-2180-4c16-bddc-51acb1d3fd6a';

-- Move PJ23JWC policy back to its own customer record
UPDATE customer_policies 
SET customer_id = 'c195e8dc-2180-4c16-bddc-51acb1d3fd6a'
WHERE id = '41067288-975b-4a00-abfd-2638d2849cb1';
