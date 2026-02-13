
-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create a function to schedule an SMS send with a delay
CREATE OR REPLACE FUNCTION public.schedule_delayed_sms(
  p_phone text,
  p_first_name text DEFAULT 'there',
  p_vehicle_make text DEFAULT NULL,
  p_vehicle_model text DEFAULT NULL,
  p_delay_seconds integer DEFAULT 600
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_request_id bigint;
  v_url text;
  v_body jsonb;
BEGIN
  v_url := 'https://mzlpuxzwyrcyrgrongeb.supabase.co/functions/v1/send-clicksend-sms';
  
  v_body := jsonb_build_object(
    'phone', p_phone,
    'firstName', p_first_name,
    'vehicleMake', p_vehicle_make,
    'vehicleModel', p_vehicle_model
  );

  -- Schedule the HTTP POST with a delay
  SELECT net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16bHB1eHp3eXJjeXJncm9uZ2ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4ODc0MjUsImV4cCI6MjA2NjQ2MzQyNX0.bFu0Zj4ic61GN0LwipkINg9YJtgd8RnMgEmzE139MPU'
    ),
    body := v_body
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$function$;
