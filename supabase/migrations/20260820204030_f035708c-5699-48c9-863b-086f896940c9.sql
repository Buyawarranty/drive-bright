-- Save-a-cancellation leads stay unassigned so any agent can grab them:
-- skip round-robin auto-assignment and ORR offers for these rescue leads.
DROP TRIGGER IF EXISTS trg_auto_assign_lead ON public.sales_leads;
CREATE TRIGGER trg_auto_assign_lead
  BEFORE INSERT ON public.sales_leads
  FOR EACH ROW
  WHEN (
    NOT (COALESCE(NEW.manual_entry, false) AND NEW.assigned_to IS NOT NULL)
    AND COALESCE(NEW.save_cancellation, false) = false
  )
  EXECUTE FUNCTION auto_assign_lead_round_robin();

DROP TRIGGER IF EXISTS trg_orr_offer_on_intake ON public.sales_leads;
CREATE TRIGGER trg_orr_offer_on_intake
  AFTER INSERT ON public.sales_leads
  FOR EACH ROW
  WHEN (
    NOT (COALESCE(NEW.manual_entry, false) AND NEW.assigned_to IS NOT NULL)
    AND COALESCE(NEW.save_cancellation, false) = false
  )
  EXECUTE FUNCTION trg_orr_offer_on_intake_fn();