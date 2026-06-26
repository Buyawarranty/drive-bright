
-- Email frequency preference: 'all' | 'essentials' | 'off'
ALTER TABLE public.marketing_audience
  ADD COLUMN IF NOT EXISTS frequency TEXT NOT NULL DEFAULT 'all'
  CHECK (frequency IN ('all', 'essentials', 'off'));

-- Backfill: anyone currently unsubscribed = 'off'; subscribed = 'all' (already default)
UPDATE public.marketing_audience
SET frequency = 'off'
WHERE is_subscribed = false AND frequency = 'all';

-- Mark email campaigns as 'essential' (renewal/policy/claims tips) or not
ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS is_essential BOOLEAN NOT NULL DEFAULT false;

-- Also store frequency on the unsubscribe record for staff/customer visibility
ALTER TABLE public.email_unsubscribes
  ADD COLUMN IF NOT EXISTS frequency TEXT NOT NULL DEFAULT 'off'
  CHECK (frequency IN ('all', 'essentials', 'off'));

COMMENT ON COLUMN public.marketing_audience.frequency IS
  'Email cadence preference: all = every marketing email; essentials = renewal/policy/claims only; off = no marketing.';
COMMENT ON COLUMN public.email_campaigns.is_essential IS
  'When true, this campaign is sent even to subscribers on the essentials-only tier (renewal reminders, claims/policy tips).';
