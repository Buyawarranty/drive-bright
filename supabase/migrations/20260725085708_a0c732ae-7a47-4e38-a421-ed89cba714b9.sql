CREATE TABLE IF NOT EXISTS public.staff_work_locations (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null,
  user_id uuid,
  email text not null,
  session_date date not null default (now() at time zone 'utc')::date,
  ip_address text not null,
  city text,
  region text,
  country text,
  country_code text,
  timezone text,
  latitude numeric,
  longitude numeric,
  isp text,
  is_vpn boolean not null default false,
  user_agent text,
  device_type text,
  ping_count integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

CREATE UNIQUE INDEX IF NOT EXISTS staff_work_locations_unique_day_ip
  ON public.staff_work_locations (admin_user_id, session_date, ip_address);
CREATE INDEX IF NOT EXISTS staff_work_locations_date_idx ON public.staff_work_locations (session_date desc);

GRANT SELECT ON public.staff_work_locations TO authenticated;
GRANT ALL ON public.staff_work_locations TO service_role;

ALTER TABLE public.staff_work_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff can view own locations" ON public.staff_work_locations;
CREATE POLICY "staff can view own locations"
ON public.staff_work_locations FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "management can view all locations" ON public.staff_work_locations;
CREATE POLICY "management can view all locations"
ON public.staff_work_locations FOR SELECT TO authenticated
USING (public.is_management(auth.uid()) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "service role manages locations" ON public.staff_work_locations;
CREATE POLICY "service role manages locations"
ON public.staff_work_locations FOR ALL TO service_role
USING (true) WITH CHECK (true);