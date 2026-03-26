
-- Table to store customer-flagged detail issues on paid quotes
CREATE TABLE public.quote_detail_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL,
  customer_name TEXT,
  customer_email TEXT,
  vehicle_reg TEXT,
  issue_message TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  resolved_by UUID REFERENCES public.admin_users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quote_detail_issues ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (customer flags from public page)
CREATE POLICY "Anyone can insert detail issues" ON public.quote_detail_issues
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Allow authenticated users to read
CREATE POLICY "Authenticated users can read detail issues" ON public.quote_detail_issues
  FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to update (resolve)
CREATE POLICY "Authenticated users can update detail issues" ON public.quote_detail_issues
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Index for quick lookups
CREATE INDEX idx_quote_detail_issues_status ON public.quote_detail_issues(status);
CREATE INDEX idx_quote_detail_issues_created_at ON public.quote_detail_issues(created_at DESC);
