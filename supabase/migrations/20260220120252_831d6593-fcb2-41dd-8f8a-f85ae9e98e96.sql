-- Drop the old INSERT-only trigger
DROP TRIGGER IF EXISTS trigger_set_warranty_number ON customer_policies;

-- Create improved function that handles both INSERT and UPDATE
CREATE OR REPLACE FUNCTION public.set_warranty_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Only set warranty number on INSERT if not already provided
        IF NEW.warranty_number IS NULL THEN
            IF NEW.is_manual_entry = true THEN
                NEW.warranty_number := public.generate_admin_warranty_number();
            ELSE
                NEW.warranty_number := public.generate_warranty_number();
            END IF;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        -- When is_manual_entry changes from false to true, switch BAW- to ADM-
        IF NEW.is_manual_entry = true AND (OLD.is_manual_entry IS NULL OR OLD.is_manual_entry = false) THEN
            IF NEW.warranty_number LIKE 'BAW-%' THEN
                NEW.warranty_number := REPLACE(NEW.warranty_number, 'BAW-', 'ADM-');
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Create trigger for both INSERT and UPDATE
CREATE TRIGGER trigger_set_warranty_number
  BEFORE INSERT OR UPDATE ON public.customer_policies
  FOR EACH ROW
  EXECUTE FUNCTION set_warranty_number();

-- Fix Waheed's existing record: manual entry should be ADM-
UPDATE customer_policies 
SET warranty_number = REPLACE(warranty_number, 'BAW-', 'ADM-')
WHERE id = '8b4404b0-1155-4b1f-ac03-4eb8d01cf563'
  AND warranty_number LIKE 'BAW-%';

-- Also sync the customers table warranty_reference_number if it has BAW- for manual entries
UPDATE customers 
SET warranty_reference_number = REPLACE(warranty_reference_number, 'BAW-', 'ADM-')
WHERE id = 'b3243431-2d57-4c64-a216-64bb8c9f031f'
  AND warranty_reference_number LIKE 'BAW-%';

-- Fix any other existing mismatches: manual entries with BAW- prefix
UPDATE customer_policies cp
SET warranty_number = REPLACE(cp.warranty_number, 'BAW-', 'ADM-')
WHERE cp.is_manual_entry = true
  AND cp.warranty_number LIKE 'BAW-%';