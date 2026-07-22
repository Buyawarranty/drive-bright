
DROP TRIGGER IF EXISTS trg_demote_new_on_call ON public.lead_call_logs;
DROP TRIGGER IF EXISTS trg_demote_new_on_note ON public.lead_quick_notes;
DROP FUNCTION IF EXISTS public.demote_new_status_on_touch();
