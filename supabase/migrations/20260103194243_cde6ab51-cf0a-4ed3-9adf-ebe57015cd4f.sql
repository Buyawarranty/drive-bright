-- Create table to store daily online time summaries
CREATE TABLE public.user_daily_online_time (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  admin_user_id UUID REFERENCES public.admin_users(id),
  date DATE NOT NULL,
  total_online_seconds INTEGER NOT NULL DEFAULT 0,
  first_online_at TIMESTAMP WITH TIME ZONE,
  last_online_at TIMESTAMP WITH TIME ZONE,
  session_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE public.user_daily_online_time ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins can view daily online time"
  ON public.user_daily_online_time
  FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Service role can manage daily online time"
  ON public.user_daily_online_time
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable realtime
ALTER TABLE public.user_daily_online_time REPLICA IDENTITY FULL;

-- Create function to update daily online time
CREATE OR REPLACE FUNCTION public.update_daily_online_time()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_last_activity TIMESTAMP WITH TIME ZONE;
  v_seconds_to_add INTEGER;
BEGIN
  -- Only track when going offline or status changes
  IF NEW.status = 'offline' AND OLD.status IN ('online', 'away', 'busy') THEN
    -- Calculate time difference from last activity
    v_last_activity := COALESCE(OLD.last_activity_at, OLD.last_seen_at);
    v_seconds_to_add := EXTRACT(EPOCH FROM (NEW.last_seen_at - v_last_activity))::INTEGER;
    
    -- Clamp to reasonable value (max 24 hours)
    v_seconds_to_add := LEAST(GREATEST(v_seconds_to_add, 0), 86400);
    
    -- Upsert the daily record
    INSERT INTO user_daily_online_time (user_id, admin_user_id, date, total_online_seconds, first_online_at, last_online_at, session_count)
    VALUES (NEW.user_id, NEW.admin_user_id, v_today, v_seconds_to_add, v_last_activity, NEW.last_seen_at, 1)
    ON CONFLICT (user_id, date) DO UPDATE SET
      total_online_seconds = user_daily_online_time.total_online_seconds + EXCLUDED.total_online_seconds,
      last_online_at = EXCLUDED.last_online_at,
      session_count = user_daily_online_time.session_count + 1,
      updated_at = now();
  END IF;
  
  -- Track first online of the day
  IF NEW.status = 'online' AND OLD.status = 'offline' THEN
    INSERT INTO user_daily_online_time (user_id, admin_user_id, date, total_online_seconds, first_online_at, session_count)
    VALUES (NEW.user_id, NEW.admin_user_id, v_today, 0, NEW.last_seen_at, 0)
    ON CONFLICT (user_id, date) DO UPDATE SET
      first_online_at = COALESCE(user_daily_online_time.first_online_at, EXCLUDED.first_online_at),
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER track_daily_online_time
  AFTER UPDATE ON public.user_presence
  FOR EACH ROW
  EXECUTE FUNCTION public.update_daily_online_time();