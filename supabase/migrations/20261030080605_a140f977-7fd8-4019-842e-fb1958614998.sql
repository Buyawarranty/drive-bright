ALTER TABLE public.lead_team_members DISABLE TRIGGER guard_own_attendance_bar_setting;
ALTER TABLE public.lead_team_members ALTER COLUMN show_own_attendance_bar SET DEFAULT true;
UPDATE public.lead_team_members SET show_own_attendance_bar = true WHERE show_own_attendance_bar = false;
ALTER TABLE public.lead_team_members ENABLE TRIGGER guard_own_attendance_bar_setting;