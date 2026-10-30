-- Temporary rows only. No staff account or production lead is changed.
BEGIN;
CREATE TEMP TABLE staff_contact_regression (
  id uuid, email text, phone text, first_name text, assigned_to uuid
) ON COMMIT DROP;
CREATE TRIGGER recover_contact BEFORE INSERT OR UPDATE ON staff_contact_regression
FOR EACH ROW EXECUTE FUNCTION public.protect_phone_on_sales_lead();
DO $test$
DECLARE r record; donor record;
BEGIN
  INSERT INTO staff_contact_regression VALUES
    ('00000000-0000-0000-0000-000000000001', NULL, '07960123456', 'Example', gen_random_uuid());
  UPDATE staff_contact_regression SET phone=NULL, first_name=NULL
    WHERE id='00000000-0000-0000-0000-000000000001';
  SELECT * INTO r FROM staff_contact_regression WHERE id='00000000-0000-0000-0000-000000000001';
  IF r.phone IS DISTINCT FROM '07960123456' OR r.first_name IS DISTINCT FROM 'Example' THEN
    RAISE EXCEPTION 'Clearing contact details must preserve existing values';
  END IF;
  SELECT email INTO donor FROM public.sales_leads
    WHERE email IS NOT NULL AND btrim(email)<>'' AND first_name IS NOT NULL AND btrim(first_name)<>'' LIMIT 1;
  IF donor.email IS NULL THEN RAISE EXCEPTION 'Missing contact-recovery test source'; END IF;
  INSERT INTO staff_contact_regression VALUES
    ('00000000-0000-0000-0000-000000000002', NULL, NULL, NULL, gen_random_uuid());
  UPDATE staff_contact_regression SET email=donor.email
    WHERE id='00000000-0000-0000-0000-000000000002';
  SELECT * INTO r FROM staff_contact_regression WHERE id='00000000-0000-0000-0000-000000000002';
  IF r.first_name IS NULL THEN RAISE EXCEPTION 'Contact edits must still recover a recorded name'; END IF;
  -- Disable only this temporary fixture's trigger to seed an incomplete old row.
  ALTER TABLE staff_contact_regression DISABLE TRIGGER recover_contact;
  INSERT INTO staff_contact_regression VALUES
    ('00000000-0000-0000-0000-000000000003', donor.email, NULL, NULL, gen_random_uuid());
  ALTER TABLE staff_contact_regression ENABLE TRIGGER recover_contact;
  UPDATE staff_contact_regression SET assigned_to=NULL
    WHERE id='00000000-0000-0000-0000-000000000003';
  SELECT * INTO r FROM staff_contact_regression WHERE id='00000000-0000-0000-0000-000000000003';
  IF r.assigned_to IS NOT NULL OR r.phone IS NOT NULL OR r.first_name IS NOT NULL THEN
    RAISE EXCEPTION 'Owner-only updates must not repeat contact recovery';
  END IF;
END;
$test$;
COMMIT;