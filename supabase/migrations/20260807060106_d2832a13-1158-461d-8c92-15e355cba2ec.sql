CREATE TABLE public.price_override_audit (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  admin_user_id uuid references public.admin_users(id) on delete set null,
  user_id uuid,
  agent_name text,
  agent_email text,
  context text not null default 'quotes_and_orders',
  customer_name text,
  customer_email text,
  vehicle_reg text,
  vehicle_make text,
  vehicle_model text,
  payment_type text,
  excess_amount numeric,
  claim_limit numeric,
  labour_rate numeric,
  matrix_total numeric,
  matrix_monthly numeric,
  entered_total numeric,
  entered_monthly numeric,
  diff_amount numeric,
  diff_pct numeric,
  floor_amount numeric,
  below_floor boolean not null default false,
  price_match_mode boolean not null default false,
  price_match_company text,
  price_match_price numeric,
  discount_auth_request_id uuid,
  notes text
);

GRANT SELECT, INSERT ON public.price_override_audit TO authenticated;
GRANT ALL ON public.price_override_audit TO service_role;

ALTER TABLE public.price_override_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can log their own price overrides"
ON public.price_override_audit FOR INSERT TO authenticated
WITH CHECK (public.is_staff());

CREATE POLICY "Staff view own overrides, management views all"
ON public.price_override_audit FOR SELECT TO authenticated
USING (
  public.is_management(auth.uid())
  OR user_id = auth.uid()
  OR admin_user_id = public.current_admin_user_id()
);

CREATE INDEX idx_price_override_audit_created_at ON public.price_override_audit (created_at DESC);
CREATE INDEX idx_price_override_audit_admin ON public.price_override_audit (admin_user_id);