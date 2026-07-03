
CREATE OR REPLACE FUNCTION public.add_arrival_timestamp_note()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ts_label text;
BEGIN
  ts_label := to_char(NEW.created_at AT TIME ZONE 'Europe/London', 'DD Mon YYYY, HH24:MI');
  INSERT INTO public.lead_quick_notes (lead_id, note_text, created_by, is_pinned)
  VALUES (
    NEW.id,
    '[' || ts_label || ' — 🤖 System] Lead arrived at ' || ts_label || ' (clock started)',
    '00000000-0000-0000-0000-000000000000',
    false
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_leads_arrival_note ON public.sales_leads;
CREATE TRIGGER trg_sales_leads_arrival_note
AFTER INSERT ON public.sales_leads
FOR EACH ROW EXECUTE FUNCTION public.add_arrival_timestamp_note();
