
-- Email unsubscribes/blocklist table
CREATE TABLE public.email_unsubscribes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  reason TEXT,
  unsubscribed_by TEXT, -- admin user id who blocked them
  unsubscribed_by_name TEXT, -- display name of admin
  source TEXT DEFAULT 'manual', -- 'manual', 'lead', 'email_marketing', 'customer_request'
  customer_name TEXT,
  vehicle_reg TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email)
);

-- Enable RLS
ALTER TABLE public.email_unsubscribes ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can read
CREATE POLICY "Authenticated users can view unsubscribes"
  ON public.email_unsubscribes FOR SELECT TO authenticated USING (true);

-- Policy: authenticated users can insert
CREATE POLICY "Authenticated users can insert unsubscribes"
  ON public.email_unsubscribes FOR INSERT TO authenticated WITH CHECK (true);

-- Policy: authenticated users can delete (to re-subscribe)
CREATE POLICY "Authenticated users can delete unsubscribes"
  ON public.email_unsubscribes FOR DELETE TO authenticated USING (true);

-- Index for quick lookups
CREATE INDEX idx_email_unsubscribes_email ON public.email_unsubscribes(email);
