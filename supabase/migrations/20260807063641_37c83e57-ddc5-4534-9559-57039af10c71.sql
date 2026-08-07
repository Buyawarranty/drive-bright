ALTER TABLE public.pricing_matrix_versions
  ADD COLUMN IF NOT EXISTS reference_vehicle jsonb,
  ADD COLUMN IF NOT EXISTS reference_factors jsonb,
  ADD COLUMN IF NOT EXISTS price_floors jsonb,
  ADD COLUMN IF NOT EXISTS price_caps jsonb,
  ADD COLUMN IF NOT EXISTS rounding_rule text,
  ADD COLUMN IF NOT EXISTS effective_date date,
  ADD COLUMN IF NOT EXISTS model_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS config_checksum text,
  ADD COLUMN IF NOT EXISTS published_by uuid;

COMMENT ON COLUMN public.pricing_matrix_versions.reference_vehicle IS 'The vehicle the admin_matrix grid was generated for (age band, mileage, powertrain, vehicle type).';
COMMENT ON COLUMN public.pricing_matrix_versions.reference_factors IS 'Vehicle factors of the reference vehicle, so live factors are applied normalised (F_current / F_reference) and never double-charge.';
COMMENT ON COLUMN public.pricing_matrix_versions.price_floors IS 'Minimum contract price per term, e.g. {"12months":399,"24months":659,"36months":938}.';
COMMENT ON COLUMN public.pricing_matrix_versions.price_caps IS 'Optional maximum contract price per term.';
COMMENT ON COLUMN public.pricing_matrix_versions.rounding_rule IS 'How totals are rounded: ceil_pound | round_pound | floor_pound.';
COMMENT ON COLUMN public.pricing_matrix_versions.config_checksum IS 'Checksum of the full pricing configuration, used to verify a historical quote was priced on this exact config.';