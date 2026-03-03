
-- Clean up existing leads where first_name is just the email local part (not a real name)
UPDATE public.sales_leads
SET first_name = NULL
WHERE first_name = split_part(lower(email), '@', 1)
  AND first_name IS NOT NULL;
