-- Drop the legacy 3-arg overload of update_lead_status so PostgREST resolves
-- unambiguously to the hardened version that accepts p_force.
DROP FUNCTION IF EXISTS public.update_lead_status(uuid, text, boolean);