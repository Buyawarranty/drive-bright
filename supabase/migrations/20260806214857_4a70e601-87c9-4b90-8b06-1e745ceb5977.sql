ALTER TABLE public.pricing_matrix_versions
  ADD COLUMN IF NOT EXISTS vehicle_factor_model jsonb;