CREATE TABLE IF NOT EXISTS public.ghl_push_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ghl_push_queue_status_check CHECK (status IN ('pending','sent','failed'))
);

CREATE INDEX IF NOT EXISTS idx_ghl_push_queue_pending
  ON public.ghl_push_queue (status, next_attempt_at)
  WHERE status = 'pending';

ALTER TABLE public.ghl_push_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role only - select" ON public.ghl_push_queue;
CREATE POLICY "service role only - select"
  ON public.ghl_push_queue FOR SELECT
  USING (false);

DROP TRIGGER IF EXISTS update_ghl_push_queue_updated_at ON public.ghl_push_queue;
CREATE TRIGGER update_ghl_push_queue_updated_at
  BEFORE UPDATE ON public.ghl_push_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'retry-ghl-pushes-every-5min') THEN
    PERFORM cron.unschedule('retry-ghl-pushes-every-5min');
  END IF;
END $$;

SELECT cron.schedule(
  'retry-ghl-pushes-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://mzlpuxzwyrcyrgrongeb.supabase.co/functions/v1/retry-ghl-pushes',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16bHB1eHp3eXJjeXJncm9uZ2ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4ODc0MjUsImV4cCI6MjA2NjQ2MzQyNX0.bFu0Zj4ic61GN0LwipkINg9YJtgd8RnMgEmzE139MPU"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);