
-- 1) Add is_recreated column
ALTER TABLE public.sales_leads ADD COLUMN IF NOT EXISTS is_recreated BOOLEAN DEFAULT FALSE;

-- 2) Update auto_create_lead_from_abandoned_cart to set is_recreated = TRUE on all UPDATE paths
-- We need to replace the function, adding is_recreated = TRUE to every UPDATE that increments resubmission_count
-- Rather than rewriting the entire 300-line function, we'll use a simpler approach:
-- Create a trigger that fires BEFORE UPDATE on sales_leads and sets is_recreated = TRUE
-- whenever resubmission_count increases

CREATE OR REPLACE FUNCTION public.mark_recreated_on_resubmission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If resubmission_count is being incremented, mark as recreated
  IF COALESCE(NEW.resubmission_count, 0) > COALESCE(OLD.resubmission_count, 0) THEN
    NEW.is_recreated := TRUE;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop if exists, then create
DROP TRIGGER IF EXISTS trg_mark_recreated_on_resubmission ON public.sales_leads;
CREATE TRIGGER trg_mark_recreated_on_resubmission
  BEFORE UPDATE ON public.sales_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_recreated_on_resubmission();
