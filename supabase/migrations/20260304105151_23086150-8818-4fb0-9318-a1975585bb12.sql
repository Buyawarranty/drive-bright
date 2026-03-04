
-- Fix the changelog trigger: remove reference to non-existent contact_notes column
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
      old_assigned_to, old_status, old_notes, old_priority,
      old_call_count, old_is_paid, old_payment_amount, old_next_action_type, old_next_action_date,
      new_assigned_to, new_status, new_notes, new_priority,
      new_call_count, new_is_paid, new_payment_amount, new_next_action_type, new_next_action_date,
      old_record, new_record
    ) VALUES (
      OLD.id, auth.uid(), 'update',
      OLD.assigned_to, OLD.status, OLD.notes, OLD.priority,
      OLD.call_count, OLD.is_paid, OLD.payment_amount, OLD.next_action_type, OLD.next_action_date,
      NEW.assigned_to, NEW.status, NEW.notes, NEW.priority,
      NEW.call_count, NEW.is_paid, NEW.payment_amount, NEW.next_action_type, NEW.next_action_date,
      to_jsonb(OLD), to_jsonb(NEW)
    );
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO sales_leads_changelog (
      lead_id, changed_by, change_type,
      new_assigned_to, new_status, new_notes, new_priority,
      new_call_count, new_is_paid, new_payment_amount, new_next_action_type, new_next_action_date,
      new_record
    ) VALUES (
      NEW.id, auth.uid(), 'insert',
      NEW.assigned_to, NEW.status, NEW.notes, NEW.priority,
      NEW.call_count, NEW.is_paid, NEW.payment_amount, NEW.next_action_type, NEW.next_action_date,
      to_jsonb(NEW)
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;
