ALTER TABLE public.pricing_matrix_versions
ADD COLUMN IF NOT EXISTS labour_rate_factors jsonb;
