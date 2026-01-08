-- Add labour_rate and boost_addon columns to admin_sent_quotes
ALTER TABLE public.admin_sent_quotes
ADD COLUMN IF NOT EXISTS labour_rate integer DEFAULT 70,
ADD COLUMN IF NOT EXISTS boost_addon boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS additional_notes text;