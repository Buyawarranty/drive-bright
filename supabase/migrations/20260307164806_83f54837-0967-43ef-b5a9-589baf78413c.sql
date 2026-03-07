
-- Table to store update requests sent to external parties
CREATE TABLE public.claim_update_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID REFERENCES public.claims_submissions(id) ON DELETE CASCADE NOT NULL,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  recipient_email TEXT NOT NULL,
  vehicle_registration TEXT,
  claim_reason TEXT,
  customer_name TEXT,
  sent_by UUID,
  sent_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '30 days'),
  is_responded BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table to store responses from external parties
CREATE TABLE public.claim_update_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.claim_update_requests(id) ON DELETE CASCADE NOT NULL,
  claim_id UUID REFERENCES public.claims_submissions(id) ON DELETE CASCADE NOT NULL,
  status_update TEXT,
  notes TEXT,
  invoice_number TEXT,
  invoice_amount NUMERIC(10,2),
  estimated_completion TEXT,
  file_url TEXT,
  file_name TEXT,
  respondent_name TEXT,
  respondent_email TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.claim_update_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_update_responses ENABLE ROW LEVEL SECURITY;

-- Admin can manage requests
CREATE POLICY "Admins can manage claim update requests" ON public.claim_update_requests
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Admin can read responses
CREATE POLICY "Admins can manage claim update responses" ON public.claim_update_responses
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Anonymous can insert responses (from public form)
CREATE POLICY "Anyone can insert claim update responses" ON public.claim_update_responses
  FOR INSERT TO anon
  WITH CHECK (true);

-- Anonymous can read requests by token (for public form)
CREATE POLICY "Anyone can read requests by token" ON public.claim_update_requests
  FOR SELECT TO anon
  USING (true);

-- Storage bucket for claim update attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('claim-updates', 'claim-updates', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can upload claim update files" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'claim-updates');

CREATE POLICY "Anyone can read claim update files" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'claim-updates');
