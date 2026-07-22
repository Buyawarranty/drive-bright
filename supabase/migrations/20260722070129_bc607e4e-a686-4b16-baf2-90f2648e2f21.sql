CREATE OR REPLACE FUNCTION public.orr_compute_next_release(_next_attempt_number integer, _last_attempt_at timestamp with time zone)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ldn_last timestamp; ldn_date date; ldn_time time;
  target_date date; target_ldn timestamp;
BEGIN
  ldn_last := (_last_attempt_at AT TIME ZONE 'Europe/London');
  ldn_date := ldn_last::date;
  ldn_time := ldn_last::time;

  IF _next_attempt_number = 2 THEN
    -- 10 minutes after Attempt 1 ends (same-agent wait)
    RETURN _last_attempt_at + interval '10 minutes';

  ELSIF _next_attempt_number = 3 THEN
    -- Prompt 9: schedule from ACTUAL completed Attempt 2 call time,
    -- using the earliest fixed queue with >= 2h cooling-off.
    IF ldn_time <= time '11:00' THEN
      target_ldn := ldn_date + time '13:00';           -- Lunchtime queue same day
    ELSIF ldn_time <= time '15:00' THEN
      target_ldn := ldn_date + time '17:00';           -- Evening queue same day
    ELSE
      target_date := public.orr_add_business_days(ldn_date, 1);
      target_ldn := target_date + time '09:30';        -- Morning queue next business day
    END IF;

  ELSIF _next_attempt_number = 4 THEN
    target_date := public.orr_add_business_days(ldn_date, 1);
    target_ldn := target_date + time '10:00';
  ELSIF _next_attempt_number = 5 THEN
    target_date := public.orr_add_business_days(ldn_date, 2);
    target_ldn := target_date + time '13:00';
  ELSIF _next_attempt_number = 6 THEN
    target_date := public.orr_add_business_days(ldn_date, 2);
    target_ldn := target_date + time '17:30';
  ELSIF _next_attempt_number = 7 THEN
    target_date := public.orr_add_business_days(ldn_date, 3);
    target_ldn := target_date + time '10:00';
  ELSE
    RETURN NULL;
  END IF;

  RETURN target_ldn AT TIME ZONE 'Europe/London';
END; $function$;