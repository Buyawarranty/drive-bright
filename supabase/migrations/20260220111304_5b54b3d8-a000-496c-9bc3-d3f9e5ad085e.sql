
-- Create a function to generate ADM- prefixed warranty numbers for manual/admin orders
CREATE OR REPLACE FUNCTION public.generate_admin_warranty_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    warranty_serial INTEGER;
    warranty_number TEXT;
    date_part TEXT;
BEGIN
    -- Use the same serial counter to avoid collisions
    warranty_serial := public.get_next_warranty_serial();
    
    -- Format date as DDMM (day and month)
    date_part := TO_CHAR(NOW(), 'DDMM');
    
    -- Format as ADM-DDMM-XXXXXX
    warranty_number := 'ADM-' || date_part || '-' || LPAD(warranty_serial::TEXT, 6, '0');
    
    RETURN warranty_number;
END;
$$;

-- Update the trigger function to check if it's a manual entry and use ADM- prefix accordingly
CREATE OR REPLACE FUNCTION public.set_warranty_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Only set warranty number if it's not already provided
    IF NEW.warranty_number IS NULL THEN
        -- Use ADM- prefix for manual entries, BAW- for website sales
        IF NEW.is_manual_entry = true THEN
            NEW.warranty_number := public.generate_admin_warranty_number();
        ELSE
            NEW.warranty_number := public.generate_warranty_number();
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;
