-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the return discount reminder function to run daily at 9 AM
SELECT cron.schedule(
  'send-return-discount-reminders',
  '0 9 * * *', -- Every day at 9 AM
  $$
  SELECT net.http_post(
      url:='https://mzlpuxzwyrcyrgrongeb.supabase.co/functions/v1/schedule-return-discount-reminders',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16bHB1eHp3eXJjeXJncm9uZ2ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4ODc0MjUsImV4cCI6MjA2NjQ2MzQyNX0.bFu0Zj4ic61GN0LwipkINg9YJtgd8RnMgEmzE139MPU"}'::jsonb,
      body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
  $$
);
