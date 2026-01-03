-- Create table to track user presence and activity
CREATE TABLE public.user_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_user_id UUID REFERENCES public.admin_users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'away', 'busy', 'offline')),
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  current_tab TEXT,
  session_started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  device_info JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view all presence data (admins need to see team status)
CREATE POLICY "Authenticated users can view presence" 
ON public.user_presence 
FOR SELECT 
TO authenticated
USING (true);

-- Users can update their own presence
CREATE POLICY "Users can update own presence" 
ON public.user_presence 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own presence
CREATE POLICY "Users can insert own presence" 
ON public.user_presence 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Create function to upsert presence
CREATE OR REPLACE FUNCTION public.update_user_presence(
  p_status TEXT DEFAULT 'online',
  p_current_tab TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_admin_user_id UUID;
  v_presence_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  -- Get admin_user_id if exists
  SELECT id INTO v_admin_user_id FROM admin_users WHERE user_id = v_user_id;
  
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
$$;

-- Create function to set user offline
CREATE OR REPLACE FUNCTION public.set_user_offline()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE user_presence 
  SET status = 'offline', 
      last_seen_at = now(),
      updated_at = now()
  WHERE user_id = auth.uid();
END;
$$;

-- Create trigger to update updated_at
CREATE TRIGGER update_user_presence_updated_at
  BEFORE UPDATE ON public.user_presence
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for presence table
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;