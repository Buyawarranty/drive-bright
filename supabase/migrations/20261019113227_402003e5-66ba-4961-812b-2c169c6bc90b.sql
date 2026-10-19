CREATE OR REPLACE FUNCTION public.reporting_sync_schedule() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE config public.reporting_scheduler_config; job bigint; command text; BEGIN
PERFORM pg_advisory_xact_lock(hashtext('head-office-reporting-schedule'));
SELECT jobid INTO job FROM cron.job WHERE jobname='head-office-reporting';
IF EXISTS(SELECT 1 FROM public.reporting_accounts WHERE enabled) THEN
SELECT * INTO config FROM public.reporting_scheduler_config WHERE id=true;
IF FOUND THEN command := format('SELECT net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb)',config.callback_url,jsonb_build_object('Content-Type','application/json','apikey',config.publishable_key)::text,'{"action":"scheduled"}');
IF job IS NULL THEN PERFORM cron.schedule('head-office-reporting','0 * * * *',command); ELSE PERFORM cron.alter_job(job,schedule := '0 * * * *',command := command,active := true); END IF;
END IF;
ELSIF job IS NOT NULL THEN PERFORM cron.unschedule(job); END IF;
RETURN NULL; END $$;
REVOKE ALL ON FUNCTION public.reporting_sync_schedule() FROM PUBLIC,anon,authenticated;