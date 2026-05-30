-- 1. Columns
ALTER TABLE public.sales_leads
  ADD COLUMN IF NOT EXISTS fake_marked_by uuid,
  ADD COLUMN IF NOT EXISTS fake_marked_at timestamptz,
  ADD COLUMN IF NOT EXISTS fake_reason text,
  ADD COLUMN IF NOT EXISTS fake_reason_note text,
  ADD COLUMN IF NOT EXISTS fake_audit_status text,
  ADD COLUMN IF NOT EXISTS fake_audited_by uuid,
  ADD COLUMN IF NOT EXISTS fake_audited_at timestamptz;

-- 2. Index for weekly/monthly grouping
CREATE INDEX IF NOT EXISTS idx_sales_leads_fake_marked_at
  ON public.sales_leads (fake_marked_at DESC)
  WHERE fake_marked_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_leads_fake_audit_status
  ON public.sales_leads (fake_audit_status)
  WHERE fake_audit_status IS NOT NULL;

-- 3. Backfill existing fake leads as pending
UPDATE public.sales_leads
SET fake_marked_at = COALESCE(fake_marked_at, lost_at, updated_at, created_at),
    fake_audit_status = COALESCE(fake_audit_status, 'pending')
WHERE status = 'fake_lead'
  AND fake_audit_status IS NULL;

-- 4. Trigger: auto-stamp marker / clear on reinstate
CREATE OR REPLACE FUNCTION public.handle_fake_lead_audit_stamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
BEGIN
  -- Resolve current admin_users.id (if the change is happening via an authenticated session)
  SELECT id INTO v_admin_id FROM public.admin_users
   WHERE user_id = auth.uid() AND is_active = true
   LIMIT 1;

  -- Transition INTO fake_lead
  IF NEW.status = 'fake_lead' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'fake_lead') THEN
    IF NEW.fake_marked_at IS NULL THEN
      NEW.fake_marked_at := now();
    END IF;
    IF NEW.fake_marked_by IS NULL THEN
      NEW.fake_marked_by := v_admin_id;
    END IF;
    IF NEW.fake_audit_status IS NULL THEN
      NEW.fake_audit_status := 'pending';
    END IF;
  END IF;

  -- Transition OUT of fake_lead -> mark as reinstated
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'fake_lead'
     AND NEW.status IS DISTINCT FROM 'fake_lead' THEN
    NEW.fake_audit_status := 'reinstated';
    NEW.fake_audited_at := now();
    IF v_admin_id IS NOT NULL THEN
      NEW.fake_audited_by := v_admin_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_leads_fake_audit_stamp ON public.sales_leads;
CREATE TRIGGER trg_sales_leads_fake_audit_stamp
BEFORE INSERT OR UPDATE OF status ON public.sales_leads
FOR EACH ROW
EXECUTE FUNCTION public.handle_fake_lead_audit_stamp();