-- One-time data restoration: restore phone numbers that were wiped by the empty-string bug
-- These numbers are sourced from the sales_leads_changelog (verified history)
UPDATE public.sales_leads SET phone = '07590191819', updated_at = now() WHERE id = '989a1296-f8d2-43ef-bb83-25ae888f974e' AND COALESCE(NULLIF(TRIM(phone), ''), '') = '';
UPDATE public.sales_leads SET phone = '07515923778', updated_at = now() WHERE id = '94d25420-a031-4506-9598-a06f15a1bb79' AND COALESCE(NULLIF(TRIM(phone), ''), '') = '';
UPDATE public.sales_leads SET phone = '07921013650', updated_at = now() WHERE id = 'f40d6664-89cc-45fe-ad77-c8d2b0521b08' AND COALESCE(NULLIF(TRIM(phone), ''), '') = '';
UPDATE public.sales_leads SET phone = '07488286891', updated_at = now() WHERE id = 'f256c2b4-2e56-4e7d-a350-38a10eebd74b' AND COALESCE(NULLIF(TRIM(phone), ''), '') = '';
UPDATE public.sales_leads SET phone = '07939318712', updated_at = now() WHERE id = '2cfc850e-0d6b-4e71-81d4-759eef427dc0' AND COALESCE(NULLIF(TRIM(phone), ''), '') = '';