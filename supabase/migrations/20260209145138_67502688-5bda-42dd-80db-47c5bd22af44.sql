-- Fix James Reed's role in admin_users
UPDATE admin_users SET role = 'sales_lead' WHERE id = '019299c4-4bb3-4cfc-b205-0d6cd4f64dd5';

-- Fix user_roles: remove old roles and add sales_lead
DELETE FROM user_roles WHERE user_id = 'd23b0491-a453-4bf1-8ec6-c0e36789842c' AND role IN ('guest', 'member');
INSERT INTO user_roles (user_id, role) VALUES ('d23b0491-a453-4bf1-8ec6-c0e36789842c', 'sales_lead') ON CONFLICT (user_id, role) DO NOTHING;