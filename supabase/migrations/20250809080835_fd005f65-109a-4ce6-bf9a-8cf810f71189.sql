-- Fix function search path security warnings
CREATE OR REPLACE FUNCTION public.generate_warranty_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    warranty_serial INTEGER;
    warranty_number TEXT;
BEGIN
    -- Get the next warranty serial number
    warranty_serial := public.get_next_warranty_serial();
    
    -- Format as BAW-XXXXXX
    warranty_number := 'BAW-' || LPAD(warranty_serial::TEXT, 6, '0');
    
    RETURN warranty_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_warranty_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only set warranty number if it's not already provided
    IF NEW.warranty_number IS NULL THEN
        NEW.warranty_number := public.generate_warranty_number();
    END IF;
    
    RETURN NEW;
END;
$$;