ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS sale_credit_admin_user_id uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sale_credit_overridden_by uuid,
  ADD COLUMN IF NOT EXISTS sale_credit_overridden_at timestamptz,
  ADD COLUMN IF NOT EXISTS sale_credit_override_reason text;

CREATE INDEX IF NOT EXISTS idx_customers_sale_credit_admin_user_id
  ON public.customers(sale_credit_admin_user_id);