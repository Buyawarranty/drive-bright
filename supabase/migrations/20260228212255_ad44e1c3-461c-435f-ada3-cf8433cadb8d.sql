
CREATE TABLE public.agent_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  shift_start time NOT NULL DEFAULT '09:00',
  shift_end time NOT NULL DEFAULT '17:00',
  is_available boolean NOT NULL DEFAULT true,
  break_start time,
  break_end time,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(admin_user_id, day_of_week)
);

ALTER TABLE public.agent_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view agent schedules"
  ON public.agent_schedules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage agent schedules"
  ON public.agent_schedules FOR ALL TO authenticated USING (true) WITH CHECK (true);
