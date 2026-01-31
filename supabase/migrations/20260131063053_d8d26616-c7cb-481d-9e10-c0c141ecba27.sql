-- Update support@buyawarranty.co.uk to have sales role so they can view their assigned leads/customers
UPDATE admin_users 
SET role = 'sales', updated_at = now()
WHERE email = 'support@buyawarranty.co.uk' AND role = 'member';