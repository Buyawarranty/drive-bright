
SET LOCAL session_replication_role = replica;
UPDATE public.sales_leads
SET owner_agent = assigned_to
WHERE owner_agent IS NULL AND assigned_to IS NOT NULL;
