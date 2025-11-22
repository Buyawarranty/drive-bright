-- Add trigger to link policies to users on insert by case-insensitive email match
CREATE OR REPLACE FUNCTION public.link_policy_to_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_record RECORD;
BEGIN
    -- If user_id is not set but email is provided, try to find the user (case insensitive)
    IF NEW.user_id IS NULL AND NEW.email IS NOT NULL THEN
        SELECT id INTO user_record
        FROM auth.users 
        WHERE LOWER(email) = LOWER(NEW.email);
        
        IF FOUND THEN
            NEW.user_id := user_record.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger on customer_policies
DROP TRIGGER IF EXISTS link_policy_to_user_trigger ON customer_policies;
CREATE TRIGGER link_policy_to_user_trigger
    BEFORE INSERT OR UPDATE ON customer_policies
    FOR EACH ROW
    EXECUTE FUNCTION public.link_policy_to_user();

-- Also update existing policies to link them to users
UPDATE customer_policies cp
SET user_id = u.id
FROM auth.users u
WHERE cp.user_id IS NULL 
AND cp.email IS NOT NULL
AND LOWER(cp.email) = LOWER(u.email);