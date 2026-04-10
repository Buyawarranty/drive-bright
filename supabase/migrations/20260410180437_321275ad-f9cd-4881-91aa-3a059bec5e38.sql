-- Update admin_users role to accounts
UPDATE admin_users SET role = 'accounts', updated_at = now() WHERE email = 'accounts@buyawarranty.co.uk';

-- Remove the stale guest role from user_roles, keeping accounts
DELETE FROM user_roles WHERE user_id = (SELECT user_id FROM admin_users WHERE email = 'accounts@buyawarranty.co.uk') AND role = 'guest';