-- Trigger function to sync customer detail changes to related tables
CREATE OR REPLACE FUNCTION public.sync_customer_details_to_related()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sync to customer_policies if email or name changed
  IF (OLD.email IS DISTINCT FROM NEW.email) OR 
     (OLD.name IS DISTINCT FROM NEW.name) OR
     (OLD.first_name IS DISTINCT FROM NEW.first_name) OR
     (OLD.last_name IS DISTINCT FROM NEW.last_name) OR
     (OLD.phone IS DISTINCT FROM NEW.phone) THEN
    
    UPDATE customer_policies
    SET 
      email = COALESCE(NEW.email, email),
      customer_full_name = COALESCE(NEW.name, customer_full_name),
      updated_at = now()
    WHERE customer_id = NEW.id;
  END IF;

  -- Sync to sales_leads matched by email (old email in case it changed)
  IF (OLD.email IS DISTINCT FROM NEW.email) OR
     (OLD.first_name IS DISTINCT FROM NEW.first_name) OR
     (OLD.last_name IS DISTINCT FROM NEW.last_name) OR
     (OLD.phone IS DISTINCT FROM NEW.phone) THEN

    UPDATE sales_leads
    SET
      email = COALESCE(NEW.email, email),
      first_name = COALESCE(NEW.first_name, first_name),
      last_name = COALESCE(NEW.last_name, last_name),
      phone = COALESCE(NEW.phone, phone),
      updated_at = now()
    WHERE email = OLD.email
       OR (NEW.registration_plate IS NOT NULL AND vehicle_reg = NEW.registration_plate);
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trg_sync_customer_details ON public.customers;

-- Create the trigger
CREATE TRIGGER trg_sync_customer_details
  AFTER UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_customer_details_to_related();