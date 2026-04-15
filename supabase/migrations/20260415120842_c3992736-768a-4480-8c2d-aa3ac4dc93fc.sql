-- Fix: admin_users role is 'guest' but should be 'accounts'
UPDATE admin_users SET role = 'accounts', updated_at = now() WHERE email = 'accounts@buyawarranty.co.uk';

-- Clean up stale guest role from user_roles, keep accounts
DELETE FROM user_roles WHERE user_id = (SELECT user_id FROM admin_users WHERE email = 'accounts@buyawarranty.co.uk') AND role = 'guest';