-- Update warranty number generation to use correct format BAW-DDMM-XXXXXX
CREATE OR REPLACE FUNCTION public.generate_warranty_number()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
    warranty_serial INTEGER;
    warranty_number TEXT;
    date_part TEXT;
BEGIN
    -- Get the next warranty serial number
    warranty_serial := public.get_next_warranty_serial();
    
    -- Format date as DDMM (day and month)
    date_part := TO_CHAR(NOW(), 'DDMM');
    
    -- Format as BAW-DDMM-XXXXXX
    warranty_number := 'BAW-' || date_part || '-' || LPAD(warranty_serial::TEXT, 6, '0');
    
    RETURN warranty_number;
END;
$function$;

-- Create customer policy record for Kamran Qureshi
INSERT INTO customer_policies (
    customer_id,
    email,
    plan_type,
    payment_type,
    policy_number,
    warranty_number,
    policy_start_date,
    policy_end_date,
    customer_full_name,
    payment_amount
)
SELECT 
    c.id,
    c.email,
    c.plan_type,
    c.payment_type,
    'POL-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0'),
    public.generate_warranty_number(),
    NOW(),
    public.calculate_policy_end_date(c.payment_type, NOW()),
    c.name,
    c.final_amount
FROM customers c
WHERE c.email = '1fairdeal@gmail.com'
AND NOT EXISTS (SELECT 1 FROM customer_policies cp WHERE cp.email = c.email);