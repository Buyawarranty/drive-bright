-- Fix linking between customer policy BAW-2509-400329 and user
UPDATE customer_policies 
SET user_id = '7bd0428d-1200-49a6-9fad-4d081bd5160d', 
    updated_at = NOW()
WHERE policy_number = 'BAW-2509-400329' 
AND email = 'buyawarranty1@gmail.com' 
AND user_id IS NULL;

-- Add a function to automatically link policies to users when they're created
-- This prevents this issue from happening again
CREATE OR REPLACE FUNCTION link_policy_to_user()
RETURNS TRIGGER AS $$
DECLARE
    user_record RECORD;
BEGIN
    -- If user_id is not set but email is provided, try to find the user
    IF NEW.user_id IS NULL AND NEW.email IS NOT NULL THEN
        SELECT id INTO user_record
        FROM auth.users 
        WHERE email = NEW.email;
        
        IF FOUND THEN
            NEW.user_id := user_record.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically link policies to users
DROP TRIGGER IF EXISTS trigger_link_policy_to_user ON customer_policies;
CREATE TRIGGER trigger_link_policy_to_user
    BEFORE INSERT OR UPDATE ON customer_policies
    FOR EACH ROW
    EXECUTE FUNCTION link_policy_to_user();