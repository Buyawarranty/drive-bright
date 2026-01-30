-- Add distribution_mode column to lead_distribution_settings
ALTER TABLE public.lead_distribution_settings 
ADD COLUMN distribution_mode TEXT NOT NULL DEFAULT 'round_robin';

-- Add comment for clarity
COMMENT ON COLUMN public.lead_distribution_settings.distribution_mode IS 'Either round_robin or percentage';