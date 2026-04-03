
CREATE OR REPLACE FUNCTION public.calculate_policy_end_date(payment_type text, start_date timestamp with time zone)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
AS $function$
DECLARE
  normalized text;
  months_to_add integer;
BEGIN
  normalized := lower(replace(replace(replace(coalesce(payment_type, ''), '-', ''), '_', ''), ' ', ''));
  
  -- Check for number-based patterns
  IF normalized LIKE '%24%' OR normalized = '2year' OR normalized = '2years' OR normalized = 'twoyear' OR normalized = 'twoyearly' THEN
    months_to_add := 24;
  ELSIF normalized LIKE '%36%' OR normalized = '3year' OR normalized = '3years' OR normalized = 'threeyear' OR normalized = 'threeyearly' THEN
    months_to_add := 36;
  ELSIF normalized LIKE '%48%' OR normalized = '4year' OR normalized = '4years' OR normalized = 'fouryear' THEN
    months_to_add := 48;
  ELSIF normalized LIKE '%60%' OR normalized = '5year' OR normalized = '5years' OR normalized = 'fiveyear' THEN
    months_to_add := 60;
  ELSE
    -- Default: 12 months for yearly, monthly, 12months, etc.
    months_to_add := 12;
  END IF;
  
  RETURN start_date + (months_to_add || ' months')::interval;
END;
$function$;
