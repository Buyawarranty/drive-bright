-- Add unique constraint on admin_users user_id if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'admin_users_user_id_key'
    ) THEN
        ALTER TABLE admin_users ADD CONSTRAINT admin_users_user_id_key UNIQUE (user_id);
    END IF;
END $$;

-- Now add the missing user role for invited user
INSERT INTO user_roles (user_id, role) 
SELECT '15da9cd0-0855-463e-aeab-ceec6c3f472d', 'admin'
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_id = '15da9cd0-0855-463e-aeab-ceec6c3f472d'
);