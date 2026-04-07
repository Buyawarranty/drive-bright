
-- Add upsell attribution columns
ALTER TABLE public.sales_leads 
  ADD COLUMN IF NOT EXISTS original_source TEXT,
  ADD COLUMN IF NOT EXISTS original_assigned_to UUID,
  ADD COLUMN IF NOT EXISTS upsold_by UUID,
  ADD COLUMN IF NOT EXISTS upsold_at TIMESTAMPTZ;

-- Auto-snapshot original attribution when status changes to upsell/upgraded
CREATE OR REPLACE FUNCTION public.snapshot_upsell_attribution()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act when status changes TO upsell or upgraded
  IF NEW.status IN ('upsell', 'upgraded') AND (OLD.status IS NULL OR OLD.status NOT IN ('upsell', 'upgraded')) THEN
    -- Snapshot original source if not already set
    IF NEW.original_source IS NULL THEN
      NEW.original_source := OLD.lead_source::TEXT;
    END IF;
    -- Snapshot original agent if not already set
    IF NEW.original_assigned_to IS NULL THEN
      NEW.original_assigned_to := OLD.assigned_to;
    END IF;
    -- Record upsell timestamp
    IF NEW.upsold_at IS NULL THEN
      NEW.upsold_at := now();
    END IF;
    -- Record who did the upsell (current agent)
    IF NEW.upsold_by IS NULL THEN
      NEW.upsold_by := NEW.assigned_to;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_upsell_attribution ON public.sales_leads;
CREATE TRIGGER trg_snapshot_upsell_attribution
  BEFORE UPDATE ON public.sales_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.snapshot_upsell_attribution();
