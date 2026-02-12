
-- Assign abandoned carts with James's notes to James Reed (auth.users ID)
UPDATE abandoned_carts 
SET contacted_by = 'd23b0491-a453-4bf1-8ec6-c0e36789842c'
WHERE contacted_by IS NULL 
  AND contact_notes IS NOT NULL 
  AND contact_notes != ''
  AND contact_notes LIKE '%- James]%';

-- Assign abandoned carts with Jas's notes to Jas King (auth.users ID)
UPDATE abandoned_carts 
SET contacted_by = '64da6999-3006-4ffb-b3d1-afaf8847641c'
WHERE contacted_by IS NULL 
  AND contact_notes IS NOT NULL 
  AND contact_notes != ''
  AND contact_notes LIKE '%- Jas]%'
  AND contact_notes NOT LIKE '%- James]%';

-- Assign sales_leads with James's notes to James Reed (admin_users ID)
UPDATE sales_leads 
SET assigned_to = '019299c4-4bb3-4cfc-b205-0d6cd4f64dd5'
WHERE assigned_to IS NULL 
  AND notes IS NOT NULL 
  AND notes != ''
  AND notes LIKE '%- James]%';

-- Assign sales_leads with Jas's notes to Jas King (admin_users ID)
UPDATE sales_leads 
SET assigned_to = '913a9a63-f3bc-4fbc-a105-3ef8dcbd6072'
WHERE assigned_to IS NULL 
  AND notes IS NOT NULL 
  AND notes != ''
  AND notes LIKE '%- Jas]%'
  AND notes NOT LIKE '%- James]%';
