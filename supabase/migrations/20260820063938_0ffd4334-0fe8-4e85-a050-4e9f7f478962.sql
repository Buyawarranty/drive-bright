CREATE TABLE IF NOT EXISTS public.agent_break_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  reason TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_break_log_agent_started ON public.agent_break_log (admin_user_id, started_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.agent_break_log TO authenticated;
GRANT ALL ON public.agent_break_log TO service_role;

ALTER TABLE public.agent_break_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view own break log, management all"
ON public.agent_break_log FOR SELECT TO authenticated
USING (
  admin_user_id = public.current_admin_user_id()
  OR public.is_management(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid() AND au.is_active = true AND au.role IN ('performance_manager','claims_manager')
  )
);

CREATE POLICY "Staff can write own break log"
ON public.agent_break_log FOR INSERT TO authenticated
WITH CHECK (
  admin_user_id = public.current_admin_user_id()
  OR public.is_management(auth.uid())
);

-- Every change of break status is journalled: the open row is closed with its
-- duration, and a new open row starts whenever the agent goes away from the phones.
CREATE OR REPLACE FUNCTION public.log_agent_break_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = OLD.status AND NEW.started_at = OLD.started_at THEN
    RETURN NEW;
  END IF;

  UPDATE public.agent_break_log
  SET ended_at = now(),
      minutes = GREATEST(0, ROUND(EXTRACT(EPOCH FROM (now() - started_at)) / 60)::int)
  WHERE admin_user_id = NEW.admin_user_id
    AND ended_at IS NULL;

  IF NEW.status <> 'available' THEN
    INSERT INTO public.agent_break_log (admin_user_id, status, reason, started_at)
    VALUES (NEW.admin_user_id, NEW.status, NEW.reason, COALESCE(NEW.started_at, now()));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_agent_break_change ON public.agent_break_status;
CREATE TRIGGER trg_log_agent_break_change
AFTER INSERT OR UPDATE ON public.agent_break_status
FOR EACH ROW EXECUTE FUNCTION public.log_agent_break_change();

-- Seed the log with any break that is open right now so nothing is lost.
INSERT INTO public.agent_break_log (admin_user_id, status, reason, started_at)
SELECT admin_user_id, status, reason, started_at
FROM public.agent_break_status
WHERE status <> 'available'
  AND NOT EXISTS (
    SELECT 1 FROM public.agent_break_log l
    WHERE l.admin_user_id = agent_break_status.admin_user_id AND l.ended_at IS NULL
  );