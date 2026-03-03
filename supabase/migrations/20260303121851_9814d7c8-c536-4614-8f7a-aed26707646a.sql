-- Clean up leads where first_name looks like an email local part
-- (matches the part before @ in the email field)
UPDATE public.sales_leads
SET first_name = NULL
WHERE first_name IS NOT NULL
  AND email IS NOT NULL
  AND lower(first_name) = lower(split_part(email, '@', 1));

-- Also clean full_name in abandoned_carts where it's just the email
UPDATE public.abandoned_carts
SET full_name = NULL
WHERE full_name IS NOT NULL
  AND email IS NOT NULL
  AND lower(full_name) = lower(email);