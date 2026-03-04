
-- Full changelog table for sales_leads: captures complete state on every UPDATE
CREATE TABLE IF NOT EXISTS public.sales_leads_changelog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid, -- auth.uid() of person who made the change
  change_type text NOT NULL DEFAULT 'update', -- 'update', 'insert', 'delete'
  
  -- Snapshot of key fields BEFORE the change
  old_assigned_to uuid,
  old_status text,
  old_notes text,
  old_contact_notes text,
  old_priority text,
  old_call_count integer,
  old_is_paid boolean,
  old_payment_amount numeric,
  old_next_action_type text,
  old_next_action_date timestamptz,
  
  -- Snapshot of key fields AFTER the change
  new_assigned_to uuid,
  new_status text,
  new_notes text,
  new_contact_notes text,
  new_priority text,
  new_call_count integer,
  new_is_paid boolean,
  new_payment_amount numeric,
  new_next_action_type text,
  new_next_action_date timestamptz,
  
  -- Full row snapshots as JSONB for complete recovery
  old_record jsonb,
  new_record jsonb
);

-- Index for fast lookups by lead and time
CREATE INDEX idx_changelog_lead_id ON public.sales_leads_changelog(lead_id, changed_at DESC);
CREATE INDEX idx_changelog_changed_at ON public.sales_leads_changelog(changed_at DESC);

-- Enable RLS
ALTER TABLE public.sales_leads_changelog ENABLE ROW LEVEL SECURITY;

-- Only authenticated admin users can read
CREATE POLICY "Admin users can read changelog"
  ON public.sales_leads_changelog
  FOR SELECT
  TO authenticated
  USING (true);

-- Only system (triggers) can insert - no direct user inserts
CREATE POLICY "System can insert changelog"
  ON public.sales_leads_changelog
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create the trigger function
CREATE OR REPLACE FUNCTION public.log_sales_lead_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO sales_leads_changelog (
      lead_id, changed_by, change_type,
      old_assigned_to, old_status, old_notes, old_contact_notes, old_priority,
      old_call_count, old_is_paid, old_payment_amount, old_next_action_type, old_next_action_date,
      new_assigned_to, new_status, new_notes, new_contact_notes, new_priority,
      new_call_count, new_is_paid, new_payment_amount, new_next_action_type, new_next_action_date,
      old_record, new_record
    ) VALUES (
      OLD.id, auth.uid(), 'update',
      OLD.assigned_to, OLD.status, OLD.notes, OLD.contact_notes, OLD.priority,
      OLD.call_count, OLD.is_paid, OLD.payment_amount, OLD.next_action_type, OLD.next_action_date,
      NEW.assigned_to, NEW.status, NEW.notes, NEW.contact_notes, NEW.priority,
      NEW.call_count, NEW.is_paid, NEW.payment_amount, NEW.next_action_type, NEW.next_action_date,
      to_jsonb(OLD), to_jsonb(NEW)
    );
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO sales_leads_changelog (
      lead_id, changed_by, change_type,
      new_assigned_to, new_status, new_notes, new_contact_notes, new_priority,
      new_call_count, new_is_paid, new_payment_amount, new_next_action_type, new_next_action_date,
      new_record
    ) VALUES (
      NEW.id, auth.uid(), 'insert',
      NEW.assigned_to, NEW.status, NEW.notes, NEW.contact_notes, NEW.priority,
      NEW.call_count, NEW.is_paid, NEW.payment_amount, NEW.next_action_type, NEW.next_action_date,
      to_jsonb(NEW)
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach trigger to sales_leads
CREATE TRIGGER trg_sales_leads_changelog
  AFTER INSERT OR UPDATE ON public.sales_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.log_sales_lead_change();

-- Function to restore a lead to a specific changelog point
CREATE OR REPLACE FUNCTION public.restore_lead_to_snapshot(p_changelog_id uuid, p_restored_by uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_changelog RECORD;
  v_snapshot jsonb;
BEGIN
  SELECT * INTO v_changelog FROM sales_leads_changelog WHERE id = p_changelog_id;
  
  IF v_changelog IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Changelog entry not found');
  END IF;
  
  -- Use old_record for updates (restore to state BEFORE that change)
  -- Use new_record for inserts (restore to state AT that point)
  IF v_changelog.change_type = 'update' THEN
    v_snapshot := v_changelog.old_record;
  ELSE
    v_snapshot := v_changelog.new_record;
  END IF;
  
  IF v_snapshot IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No snapshot data available for this entry');
  END IF;
  
  -- Restore key fields
  UPDATE sales_leads
  SET 
    assigned_to = (v_snapshot->>'assigned_to')::uuid,
    status = v_snapshot->>'status',
    notes = v_snapshot->>'notes',
    contact_notes = v_snapshot->>'contact_notes',
    priority = v_snapshot->>'priority',
    call_count = COALESCE((v_snapshot->>'call_count')::integer, 0),
    is_paid = COALESCE((v_snapshot->>'is_paid')::boolean, false),
    payment_amount = (v_snapshot->>'payment_amount')::numeric,
    next_action_type = v_snapshot->>'next_action_type',
    next_action_date = (v_snapshot->>'next_action_date')::timestamptz,
    updated_at = now()
  WHERE id = v_changelog.lead_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'lead_id', v_changelog.lead_id,
    'restored_to', v_changelog.changed_at,
    'message', 'Lead restored successfully'
  );
END;
$$;
