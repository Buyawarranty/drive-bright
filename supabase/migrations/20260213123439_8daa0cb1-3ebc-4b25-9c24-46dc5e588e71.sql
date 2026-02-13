
-- Create scheduled_sms table for delayed SMS sending
CREATE TABLE public.scheduled_sms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  first_name TEXT DEFAULT 'there',
  vehicle_make TEXT,
  vehicle_model TEXT,
  send_after TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- Enable RLS
ALTER TABLE public.scheduled_sms ENABLE ROW LEVEL SECURITY;

-- Allow anon insert (from frontend quote flow)
CREATE POLICY "Allow anon insert scheduled_sms" ON public.scheduled_sms
  FOR INSERT TO anon WITH CHECK (true);

-- Allow service role full access (for cron processing)
CREATE POLICY "Allow service role all on scheduled_sms" ON public.scheduled_sms
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Drop the previous function that won't work with delay
DROP FUNCTION IF EXISTS public.schedule_delayed_sms(text, text, text, text, integer);

-- Create a function to process pending scheduled SMS via pg_net
CREATE OR REPLACE FUNCTION public.process_scheduled_sms()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_record RECORD;
  v_count INTEGER := 0;
  v_url TEXT := 'https://mzlpuxzwyrcyrgrongeb.supabase.co/functions/v1/send-clicksend-sms';
BEGIN
  FOR v_record IN
    SELECT * FROM scheduled_sms
    WHERE status = 'pending'
      AND send_after <= now()
    ORDER BY send_after ASC
    LIMIT 10
  LOOP
    -- Mark as processing to avoid double-send
    UPDATE scheduled_sms SET status = 'processing' WHERE id = v_record.id;
    
    -- Send via pg_net
    PERFORM net.http_post(
      url := v_url,
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16bHB1eHp3eXJjeXJncm9uZ2ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4ODc0MjUsImV4cCI6MjA2NjQ2MzQyNX0.bFu0Zj4ic61GN0LwipkINg9YJtgd8RnMgEmzE139MPU"}'::jsonb,
      body := jsonb_build_object(
        'phone', v_record.phone,
        'firstName', v_record.first_name,
        'vehicleMake', v_record.vehicle_make,
        'vehicleModel', v_record.vehicle_model
      )
    );
    
    UPDATE scheduled_sms SET status = 'sent', sent_at = now() WHERE id = v_record.id;
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$function$;
