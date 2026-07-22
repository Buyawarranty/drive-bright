CREATE OR REPLACE FUNCTION public.orr_compute_next_release(_next_attempt_number integer, _last_attempt_at timestamp with time zone)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ldn_last timestamp; ldn_date date; ldn_time time;
  target_date date; target_ldn timestamp;
  period_is_morning boolean;   -- period the last actual call came from
BEGIN
  ldn_last := (_last_attempt_at AT TIME ZONE 'Europe/London');
  ldn_date := ldn_last::date;
  ldn_time := ldn_last::time;

  -- Classify the completed call's queue period by its clock time (London).
  -- < 12:00 = Morning queue (09:30), 12:00–16:29 = Lunchtime (13:00), else Evening (17:00).
  period_is_morning := (ldn_time < time '12:00');

  IF _next_attempt_number = 2 THEN
    -- 10 minutes after Attempt 1 ends (same-agent wait window).
    RETURN _last_attempt_at + interval '10 minutes';

  ELSIF _next_attempt_number = 3 THEN
    -- Prompt 9: earliest fixed queue with >= 2h cooling-off from actual A2 completion.
    IF ldn_time <= time '11:00' THEN
      target_ldn := ldn_date + time '13:00';           -- Lunchtime queue same day
    ELSIF ldn_time <= time '15:00' THEN
      target_ldn := ldn_date + time '17:00';           -- Evening queue same day
    ELSE
      target_date := public.orr_add_business_days(ldn_date, 1);
      target_ldn := target_date + time '09:30';        -- Morning queue next bd
    END IF;

  ELSIF _next_attempt_number = 4 THEN
    -- Based on which queue Attempt 3 actually ran from:
    --   Morning (< 12:00)   → 17:00 same business day
    --   Lunchtime (12:00-16:29) → 17:00 next business day
    --   Evening (>= 16:30)  → 09:30 next business day
    IF period_is_morning THEN
      target_ldn := ldn_date + time '17:00';
    ELSIF ldn_time < time '16:30' THEN
      target_date := public.orr_add_business_days(ldn_date, 1);
      target_ldn := target_date + time '17:00';
    ELSE
      target_date := public.orr_add_business_days(ldn_date, 1);
      target_ldn := target_date + time '09:30';
    END IF;

  ELSIF _next_attempt_number = 5 THEN
    -- Skip the next business day, use the OPPOSITE period, +2 business days.
    target_date := public.orr_add_business_days(ldn_date, 2);
    IF period_is_morning THEN
      target_ldn := target_date + time '17:00';        -- morning A4 → evening A5
    ELSE
      target_ldn := target_date + time '09:30';        -- evening A4 → morning A5
    END IF;

  ELSIF _next_attempt_number = 6 THEN
    -- Next business day, opposite period.
    target_date := public.orr_add_business_days(ldn_date, 1);
    IF period_is_morning THEN
      target_ldn := target_date + time '17:00';
    ELSE
      target_ldn := target_date + time '09:30';
    END IF;

  ELSIF _next_attempt_number = 7 THEN
    -- Next business day, opposite period. Final normal attempt.
    target_date := public.orr_add_business_days(ldn_date, 1);
    IF period_is_morning THEN
      target_ldn := target_date + time '17:00';
    ELSE
      target_ldn := target_date + time '09:30';
    END IF;

  ELSE
    RETURN NULL;
  END IF;

  RETURN target_ldn AT TIME ZONE 'Europe/London';
END; $function$;