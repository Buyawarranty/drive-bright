-- Schedule auto-completion of pending Bumper transactions every 10 minutes
-- This catches any transactions where Bumper webhook didn't fire
SELECT cron.schedule(
  'auto-complete-pending-bumper-transactions',
  '*/10 * * * *', -- Every 10 minutes
  $$
  SELECT
    net.http_post(
        url:='https://mzlpuxzwyrcyrgrongeb.supabase.co/functions/v1/auto-complete-pending-bumper',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16bHB1eHp3eXJjeXJncm9uZ2ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4ODc0MjUsImV4cCI6MjA2NjQ2MzQyNX0.bFu0Zj4ic61GN0LwipkINg9YJtgd8RnMgEmzE139MPU"}'::jsonb
    ) as request_id;
  $$
);