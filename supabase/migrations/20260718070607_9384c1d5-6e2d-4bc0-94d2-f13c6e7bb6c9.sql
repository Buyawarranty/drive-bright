
CREATE TABLE IF NOT EXISTS public.agent_weekend_shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  slot TEXT NOT NULL CHECK (slot IN ('sat_am','sat_pm','sun_am','sun_pm')),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (admin_user_id, shift_date, slot)
);
CREATE INDEX IF NOT EXISTS idx_agent_weekend_shifts_date ON public.agent_weekend_shifts(shift_date);
CREATE INDEX IF NOT EXISTS idx_agent_weekend_shifts_admin ON public.agent_weekend_shifts(admin_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_weekend_shifts TO authenticated;
GRANT ALL ON public.agent_weekend_shifts TO service_role;

ALTER TABLE public.agent_weekend_shifts ENABLE ROW LEVEL SECURITY;

-- All authenticated admin users can view all weekend shifts (agents & managers see roster)
CREATE POLICY "Admin users can view weekend shifts"
ON public.agent_weekend_shifts FOR SELECT
TO authenticated
USING (public.is_active_admin_user(auth.uid()));

-- Agents can insert/delete their own weekend shift picks
CREATE POLICY "Agents can manage own weekend shifts"
ON public.agent_weekend_shifts FOR INSERT
TO authenticated
WITH CHECK (
  admin_user_id IN (SELECT id FROM public.admin_users WHERE user_id = auth.uid())
);

CREATE POLICY "Agents can delete own weekend shifts"
ON public.agent_weekend_shifts FOR DELETE
TO authenticated
USING (
  admin_user_id IN (SELECT id FROM public.admin_users WHERE user_id = auth.uid())
  OR public.is_management(auth.uid())
);

-- Management can insert/update/delete for any agent
CREATE POLICY "Management can manage all weekend shifts"
ON public.agent_weekend_shifts FOR INSERT
TO authenticated
WITH CHECK (public.is_management(auth.uid()));

CREATE POLICY "Management can update weekend shifts"
ON public.agent_weekend_shifts FOR UPDATE
TO authenticated
USING (public.is_management(auth.uid()))
WITH CHECK (public.is_management(auth.uid()));
