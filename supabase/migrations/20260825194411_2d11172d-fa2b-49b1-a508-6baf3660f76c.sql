ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS access_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_temp_access boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.admin_users.access_expires_at IS 'Optional expiry for temporary staff/developer logins. After this moment the login is refused and the account is auto-deactivated.';
COMMENT ON COLUMN public.admin_users.is_temp_access IS 'True for short-lived temporary developer/contractor logins.';

CREATE OR REPLACE FUNCTION public.expire_temp_admin_logins()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE public.admin_users
     SET is_active = false, updated_at = now()
   WHERE access_expires_at IS NOT NULL
     AND access_expires_at < now()
     AND is_active = true;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_temp_admin_logins() TO authenticated, service_role;