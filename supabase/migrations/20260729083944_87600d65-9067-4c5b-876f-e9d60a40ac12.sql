ALTER TABLE public.lead_distribution_settings
  ADD COLUMN IF NOT EXISTS strict_rotation_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS strict_rotation_cursor integer NOT NULL DEFAULT 0;