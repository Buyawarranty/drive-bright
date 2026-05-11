SELECT cron.schedule(
  'process-scheduled-emails-every-5-min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://mzlpuxzwyrcyrgrongeb.supabase.co/functions/v1/process-scheduled-emails',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16bHB1eHp3eXJjeXJncm9uZ2ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4ODc0MjUsImV4cCI6MjA2NjQ2MzQyNX0.bFu0Zj4ic61GN0LwipkINg9YJtgd8RnMgEmzE139MPU"}'::jsonb,
    body := concat('{"triggered_at": "', now(), '"}')::jsonb
  ) as request_id;
  $$
);