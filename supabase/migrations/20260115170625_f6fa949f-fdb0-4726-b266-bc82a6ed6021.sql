-- Fix the customer_policies for Alex McGrath to link to the correct auth user
-- The customer changed email from alex.mcgrath@hotmail.co.uk to alexander.s.mcgrath@gmail.com
-- The new auth user with email alexander.s.mcgrath@gmail.com has ID c3c97a20-56d7-4b5f-a308-99ae23072b15

UPDATE customer_policies 
SET 
  email = 'alexander.s.mcgrath@gmail.com',
  user_id = 'c3c97a20-56d7-4b5f-a308-99ae23072b15',
  updated_at = NOW()
WHERE customer_id = '325b5e1c-c431-4054-ad1c-358388c10f66';

-- Also create a function to help link policies to auth users when email is updated
CREATE OR REPLACE FUNCTION public.link_policy_to_user_by_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_record RECORD;
BEGIN
    -- If email changed, try to find the auth user with the new email
    IF NEW.email IS NOT NULL AND (OLD.email IS NULL OR NEW.email != OLD.email) THEN
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

-- Create trigger to auto-link user on email update
DROP TRIGGER IF EXISTS trigger_link_policy_on_email_update ON public.customer_policies;
CREATE TRIGGER trigger_link_policy_on_email_update
    BEFORE UPDATE ON public.customer_policies
    FOR EACH ROW
    EXECUTE FUNCTION public.link_policy_to_user_by_email();