DO $$
DECLARE definition text;
BEGIN
  definition := pg_get_functiondef('public.assign_recontact_leads_to_agent(uuid,integer)'::regprocedure);
  definition := replace(definition, '_caller_role NOT IN (''admin'',''super_admin'',''sales_manager'')', '_caller_role NOT IN (''admin'',''super_admin'')');
  definition := replace(definition, '''not_management''::text', '''not_admin''::text');
  definition := replace(definition, 'IF _batch_size > 200 THEN _batch_size := 200; END IF;', E'IF _batch_size > 100 THEN\n    RETURN QUERY SELECT 0, ''batch_limit''::text, 0;\n    RETURN;\n  END IF;');
  IF position('_batch_size > 100' in definition)=0 OR position('_caller_role NOT IN (''admin'',''super_admin'')' in definition)=0 THEN
    RAISE EXCEPTION 'Unexpected Goldmine allocation definition';
  END IF;
  EXECUTE definition;
END $$;
CREATE OR REPLACE FUNCTION public.claim_recontact_leads_batch(_batch_size integer DEFAULT 200, _force boolean DEFAULT false)
RETURNS TABLE(claimed_count integer, blocked_reason text, pending_count integer, pool_remaining integer, oldest_age_days integer)
LANGUAGE sql SECURITY INVOKER SET search_path=public
AS $$ SELECT 0, 'admin_release_required'::text, 0, 0, 0 $$;
CREATE OR REPLACE FUNCTION public.claim_recontact_leads_self(_lead_ids uuid[])
RETURNS TABLE(claimed_id uuid)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public
AS $$ BEGIN RAISE EXCEPTION 'admin_release_required'; END $$;
REVOKE ALL ON FUNCTION public.assign_recontact_leads_to_agent(uuid,integer), public.claim_recontact_leads_batch(integer,boolean), public.claim_recontact_leads_self(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_recontact_leads_to_agent(uuid,integer), public.claim_recontact_leads_batch(integer,boolean), public.claim_recontact_leads_self(uuid[]) TO authenticated, service_role;