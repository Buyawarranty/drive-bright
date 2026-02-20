ALTER TABLE public.abandoned_carts 
  ADD COLUMN IF NOT EXISTS claim_limit integer,
  ADD COLUMN IF NOT EXISTS labour_rate integer,
  ADD COLUMN IF NOT EXISTS voluntary_excess integer,
  ADD COLUMN IF NOT EXISTS total_price numeric,
  ADD COLUMN IF NOT EXISTS address jsonb,
  ADD COLUMN IF NOT EXISTS protection_addons jsonb;