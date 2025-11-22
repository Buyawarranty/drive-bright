-- Create a cron job to run the abandoned cart email scheduler every 5 minutes
select cron.schedule(
  'schedule-abandoned-cart-emails-every-5-min',
  '*/5 * * * *',
  $$
  select
    net.http_post(
        url:='https://mzlpuxzwyrcyrgrongeb.supabase.co/functions/v1/schedule-abandoned-cart-emails',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16bHB1eHp3eXJjeXJncm9uZ2ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4ODc0MjUsImV4cCI6MjA2NjQ2MzQyNX0.bFu0Zj4ic61GN0LwipkINg9YJtgd8RnMgEmzE139MPU"}'::jsonb,
        body:=concat('{"triggered_at": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);
