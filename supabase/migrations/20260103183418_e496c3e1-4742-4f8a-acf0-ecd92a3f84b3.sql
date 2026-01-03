-- Create activity log table to track when users come online/offline
CREATE TABLE public.user_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_user_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('online', 'offline', 'away', 'busy')),
  current_tab TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_user_activity_log_user_id ON public.user_activity_log(user_id);
CREATE INDEX idx_user_activity_log_created_at ON public.user_activity_log(created_at DESC);
CREATE INDEX idx_user_activity_log_admin_user_id ON public.user_activity_log(admin_user_id);

-- Enable RLS
ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view activity logs
CREATE POLICY "Admins can view all activity logs"
ON public.user_activity_log
FOR SELECT
USING (public.is_admin(auth.uid()));

-- Users can insert their own activity logs
CREATE POLICY "Users can log their own activity"
ON public.user_activity_log
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Update the update_user_presence function to also log activity changes
CREATE OR REPLACE FUNCTION public.update_user_presence(p_status text DEFAULT 'online'::text, p_current_tab text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_admin_user_id UUID;
  v_presence_id UUID;
  v_old_status TEXT;
BEGIN
  v_user_id := auth.uid();
  
  -- Get admin_user_id if exists
  SELECT id INTO v_admin_user_id FROM admin_users WHERE user_id = v_user_id;
  
  -- Get old status for comparison
  SELECT status INTO v_old_status FROM user_presence WHERE user_id = v_user_id;
  
  -- Log activity if status changed or this is first login
  IF v_old_status IS NULL OR v_old_status != p_status THEN
    INSERT INTO user_activity_log (user_id, admin_user_id, activity_type, current_tab)
    VALUES (v_user_id, v_admin_user_id, p_status, p_current_tab);
  END IF;
  
  -- Upsert presence record
  INSERT INTO user_presence (user_id, admin_user_id, status, current_tab, last_seen_at, last_activity_at, session_started_at)
  VALUES (v_user_id, v_admin_user_id, p_status, p_current_tab, now(), now(), now())
  ON CONFLICT (user_id) DO UPDATE SET
    status = p_status,
    current_tab = COALESCE(p_current_tab, user_presence.current_tab),
    last_seen_at = now(),
    last_activity_at = CASE WHEN p_status = 'online' THEN now() ELSE user_presence.last_activity_at END,
    updated_at = now()
  RETURNING id INTO v_presence_id;
  
  RETURN v_presence_id;
END;
$function$;

-- Update set_user_offline to also log the offline event
CREATE OR REPLACE FUNCTION public.set_user_offline()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_user_id UUID;
BEGIN
  -- Get admin_user_id
  SELECT id INTO v_admin_user_id FROM admin_users WHERE user_id = auth.uid();
  
  -- Log offline activity
  INSERT INTO user_activity_log (user_id, admin_user_id, activity_type)
  VALUES (auth.uid(), v_admin_user_id, 'offline');
  
  -- Update presence
  UPDATE user_presence 
  SET status = 'offline', 
      last_seen_at = now(),
      updated_at = now()
  WHERE user_id = auth.uid();
END;
$function$;