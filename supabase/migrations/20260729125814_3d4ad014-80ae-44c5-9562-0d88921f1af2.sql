ALTER TABLE public.sales_leads
  ADD COLUMN IF NOT EXISTS manual_entry boolean NOT NULL DEFAULT false;

-- Manual adds keep the assignee the agent picked: skip the auto-router and the
-- sales-only guard for those rows only.
DROP TRIGGER IF EXISTS trg_auto_assign_lead ON public.sales_leads;
CREATE TRIGGER trg_auto_assign_lead
BEFORE INSERT ON public.sales_leads
FOR EACH ROW
WHEN (NOT (COALESCE(NEW.manual_entry, false) AND NEW.assigned_to IS NOT NULL))
EXECUTE FUNCTION auto_assign_lead_round_robin();

DROP TRIGGER IF EXISTS trg_guard_assignee_must_be_sales ON public.sales_leads;
CREATE TRIGGER trg_guard_assignee_must_be_sales
BEFORE INSERT OR UPDATE OF assigned_to ON public.sales_leads
FOR EACH ROW
WHEN (NOT COALESCE(NEW.manual_entry, false))
EXECUTE FUNCTION guard_assignee_must_be_sales();

DROP TRIGGER IF EXISTS trg_orr_offer_on_intake ON public.sales_leads;
CREATE TRIGGER trg_orr_offer_on_intake
AFTER INSERT ON public.sales_leads
FOR EACH ROW
WHEN (NOT (COALESCE(NEW.manual_entry, false) AND NEW.assigned_to IS NOT NULL))
EXECUTE FUNCTION trg_orr_offer_on_intake_fn();

DROP TRIGGER IF EXISTS trg_shark_tank_enqueue ON public.sales_leads;
CREATE TRIGGER trg_shark_tank_enqueue
AFTER INSERT ON public.sales_leads
FOR EACH ROW
WHEN (NOT (COALESCE(NEW.manual_entry, false) AND NEW.assigned_to IS NOT NULL))
EXECUTE FUNCTION shark_tank_enqueue_lead();