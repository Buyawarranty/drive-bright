ALTER TABLE public.pricing_matrix_versions
ADD COLUMN IF NOT EXISTS claim_limit_factors jsonb;