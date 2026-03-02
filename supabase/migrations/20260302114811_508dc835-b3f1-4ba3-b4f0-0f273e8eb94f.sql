-- Ensure every active sales/sales_lead admin user is automatically added to round-robin pool
CREATE OR REPLACE FUNCTION public.ensure_agent_distribution_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active = true AND NEW.role IN ('sales', 'sales_lead') THEN
    INSERT INTO public.agent_distribution_caps (
      admin_user_id,
      daily_cap,
      assigned_today,
      paused,
      percentage,
      cap_reset_date
    )
    VALUES (
      NEW.id,
      20,
      0,
      false,
      0,
      CURRENT_DATE
    )
    ON CONFLICT (admin_user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_agent_distribution_cap ON public.admin_users;
CREATE TRIGGER trg_ensure_agent_distribution_cap
AFTER INSERT OR UPDATE OF role, is_active
ON public.admin_users
FOR EACH ROW
EXECUTE FUNCTION public.ensure_agent_distribution_cap();

-- Backfill existing active sales users missing from pool
INSERT INTO public.agent_distribution_caps (
  admin_user_id,
  daily_cap,
  assigned_today,
  paused,
  percentage,
  cap_reset_date
)
SELECT
  au.id,
  20,
  0,
  false,
  0,
  CURRENT_DATE
FROM public.admin_users au
LEFT JOIN public.agent_distribution_caps adc
  ON adc.admin_user_id = au.id
WHERE au.is_active = true
  AND au.role IN ('sales', 'sales_lead')
  AND adc.admin_user_id IS NULL;