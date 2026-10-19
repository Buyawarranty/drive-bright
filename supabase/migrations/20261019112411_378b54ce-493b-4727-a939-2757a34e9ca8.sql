CREATE TABLE public.reporting_scheduler_config (id boolean PRIMARY KEY DEFAULT true, callback_url text NOT NULL, publishable_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()); GRANT ALL ON public.reporting_scheduler_config TO service_role; ALTER TABLE public.reporting_scheduler_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY reporting_scheduler_service ON public.reporting_scheduler_config FOR ALL TO service_role USING(true) WITH CHECK(true);
CREATE FUNCTION public.reporting_sync_schedule() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE config public.reporting_scheduler_config; job bigint; command text; BEGIN
SELECT jobid INTO job FROM cron.job WHERE jobname='head-office-reporting';
IF EXISTS(SELECT 1 FROM public.reporting_accounts WHERE enabled) THEN
SELECT * INTO config FROM public.reporting_scheduler_config LIMIT 1;
IF FOUND THEN command := format('SELECT net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb)',config.callback_url,jsonb_build_object('Content-Type','application/json','apikey',config.publishable_key)::text,'{"action":"scheduled"}'); PERFORM cron.schedule('head-office-reporting','0 * * * *',command); END IF;
ELSIF job IS NOT NULL THEN PERFORM cron.unschedule(job); END IF;
RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.reporting_sync_schedule() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER reporting_schedule_toggle AFTER INSERT OR UPDATE OF enabled ON public.reporting_accounts FOR EACH STATEMENT EXECUTE FUNCTION public.reporting_sync_schedule();
CREATE TRIGGER reporting_scheduler_setup AFTER INSERT OR UPDATE ON public.reporting_scheduler_config FOR EACH STATEMENT EXECUTE FUNCTION public.reporting_sync_schedule();