-- Add missing user role for invited user
INSERT INTO user_roles (user_id, role) 
SELECT '15da9cd0-0855-463e-aeab-ceec6c3f472d', 'admin'
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_id = '15da9cd0-0855-463e-aeab-ceec6c3f472d'
);