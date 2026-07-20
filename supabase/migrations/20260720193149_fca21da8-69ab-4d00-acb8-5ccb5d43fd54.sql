-- Per-agent maximum discount % they can apply on Get Quote / manual orders.
-- NULL = use the system default (20%). Set 0 to block agent from any discount.
ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS max_discount_pct numeric(5,2);

COMMENT ON COLUMN public.admin_users.max_discount_pct IS
  'Maximum discount percent this agent may apply to a quote on the Get Quote (page 1) screen. NULL = system default (20). 0 = no discounts allowed. Managed by admins.';