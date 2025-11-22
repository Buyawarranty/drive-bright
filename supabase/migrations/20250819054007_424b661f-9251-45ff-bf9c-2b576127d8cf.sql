-- Reset password for admin@example.com and create a new temporary password
DO $$
DECLARE
    user_id_var uuid;
    new_password text := 'TempPass123!';
BEGIN
    -- Get the user ID
    SELECT id INTO user_id_var FROM auth.users WHERE email = 'admin@example.com';
    
    IF user_id_var IS NOT NULL THEN
        -- Update the user's password
        UPDATE auth.users 
        SET 
            encrypted_password = crypt(new_password, gen_salt('bf')),
            updated_at = now()
        WHERE id = user_id_var;
        
        RAISE NOTICE 'Password reset for admin@example.com. New password: %', new_password;
    ELSE
        RAISE EXCEPTION 'User admin@example.com not found';
    END IF;
END $$;