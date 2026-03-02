
-- Create trigger function to auto-create a sales_lead from every abandoned cart
CREATE OR REPLACE FUNCTION public.auto_create_lead_from_abandoned_cart()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing_id UUID;
  v_first_name TEXT;
  v_last_name TEXT;
BEGIN
  -- Check if a sales_lead already exists for this email (avoid duplicates)
  SELECT id INTO v_existing_id
  FROM sales_leads
  WHERE LOWER(email) = LOWER(NEW.email)
    AND is_paid = false
    AND status NOT IN ('converted', 'lost', 'fake_lead')
  LIMIT 1;

  -- If lead already exists, just link the abandoned_cart_id and update vehicle info
  IF v_existing_id IS NOT NULL THEN
    UPDATE sales_leads
    SET abandoned_cart_id = NEW.id,
        vehicle_reg = COALESCE(NEW.vehicle_reg, vehicle_reg),
        vehicle_make = COALESCE(NEW.vehicle_make, vehicle_make),
        vehicle_model = COALESCE(NEW.vehicle_model, vehicle_model),
        vehicle_year = COALESCE(NEW.vehicle_year, vehicle_year),
        vehicle_type = COALESCE(NEW.vehicle_type, vehicle_type),
        mileage = COALESCE(NEW.mileage, mileage),
        phone = COALESCE(NEW.phone, phone),
        plan_interest = COALESCE(NEW.plan_name, plan_interest),
        cart_value = COALESCE(NEW.total_price, cart_value),
        last_activity_date = now(),
        updated_at = now()
    WHERE id = v_existing_id;
    RETURN NEW;
  END IF;

  -- Parse full_name into first/last
  v_first_name := SPLIT_PART(COALESCE(NEW.full_name, NEW.email), ' ', 1);
  v_last_name := NULLIF(TRIM(SUBSTRING(COALESCE(NEW.full_name, '') FROM POSITION(' ' IN COALESCE(NEW.full_name, '')) + 1)), '');

  -- Create a new sales_lead (the auto_assign_lead_round_robin trigger will assign it)
  INSERT INTO sales_leads (
    first_name, last_name, email, phone,
    lead_source, status, priority,
    vehicle_reg, vehicle_make, vehicle_model, vehicle_year, vehicle_type,
    mileage, plan_interest, cart_value,
    abandoned_cart_id
  ) VALUES (
    v_first_name, v_last_name, LOWER(NEW.email), NEW.phone,
    'website', 'new', 'medium',
    NEW.vehicle_reg, NEW.vehicle_make, NEW.vehicle_model, NEW.vehicle_year, NEW.vehicle_type,
    NEW.mileage, NEW.plan_name, NEW.total_price,
    NEW.id
  );

  RETURN NEW;
END;
$$;

-- Create the trigger on abandoned_carts (AFTER INSERT so cart is committed first)
CREATE TRIGGER trg_auto_create_lead_from_cart
AFTER INSERT ON public.abandoned_carts
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_lead_from_abandoned_cart();
