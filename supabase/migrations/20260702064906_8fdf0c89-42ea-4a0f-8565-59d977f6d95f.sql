
CREATE OR REPLACE FUNCTION public.update_daily_online_time()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := (COALESCE(NEW.last_seen_at, now()) AT TIME ZONE 'UTC')::date;
  v_delta INTEGER := 0;
  v_max_gap CONSTANT INTEGER := 60; -- cap per-heartbeat gap (heartbeat is 15s)
BEGIN
  -- 1) Accumulate online seconds on every heartbeat while the user was online/away.
  --    Uses the delta between the previous and current last_seen_at, capped so
  --    that long gaps (browser closed, laptop asleep) don't inflate totals.
  IF OLD.last_seen_at IS NOT NULL
     AND NEW.last_seen_at IS NOT NULL
     AND NEW.last_seen_at > OLD.last_seen_at
     AND OLD.status IN ('online', 'away', 'busy')
  THEN
    v_delta := LEAST(
      GREATEST(EXTRACT(EPOCH FROM (NEW.last_seen_at - OLD.last_seen_at))::INTEGER, 0),
      v_max_gap
    );

    IF v_delta > 0 THEN
      INSERT INTO user_daily_online_time (
        user_id, admin_user_id, date, total_online_seconds,
        first_online_at, last_online_at, session_count
      )
      VALUES (
        NEW.user_id, NEW.admin_user_id, v_today, v_delta,
        OLD.last_seen_at, NEW.last_seen_at, 0
      )
      ON CONFLICT (user_id, date) DO UPDATE SET
        total_online_seconds = user_daily_online_time.total_online_seconds + EXCLUDED.total_online_seconds,
        last_online_at = EXCLUDED.last_online_at,
        first_online_at = COALESCE(user_daily_online_time.first_online_at, EXCLUDED.first_online_at),
        updated_at = now();
    END IF;
  END IF;

  -- 2) Increment session_count only on genuine offline -> online transitions,
  --    and set first_online_at for the day if not already set.
  IF NEW.status = 'online' AND (OLD.status IS DISTINCT FROM 'online') AND OLD.status = 'offline' THEN
    INSERT INTO user_daily_online_time (
      user_id, admin_user_id, date, total_online_seconds,
      first_online_at, last_online_at, session_count
    )
    VALUES (
      NEW.user_id, NEW.admin_user_id, v_today, 0,
      NEW.last_seen_at, NEW.last_seen_at, 1
    )
    ON CONFLICT (user_id, date) DO UPDATE SET
      session_count = user_daily_online_time.session_count + 1,
      first_online_at = COALESCE(user_daily_online_time.first_online_at, EXCLUDED.first_online_at),
      updated_at = now();
  END IF;

  -- 3) Always update last_online_at when moving to offline (for "last activity" display).
  IF NEW.status = 'offline' AND OLD.status IN ('online', 'away', 'busy') THEN
    UPDATE user_daily_online_time
    SET last_online_at = GREATEST(COALESCE(last_online_at, NEW.last_seen_at), NEW.last_seen_at),
        updated_at = now()
    WHERE user_id = NEW.user_id AND date = v_today;
  END IF;

  RETURN NEW;
END;
$$;
