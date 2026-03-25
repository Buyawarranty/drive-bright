CREATE TABLE public.lead_access_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.sales_leads(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
    approved_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
    reason TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(lead_id, requested_by)
);

ALTER TABLE public.lead_access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view access requests"
ON public.lead_access_requests FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anyone authenticated can create access requests"
ON public.lead_access_requests FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Anyone authenticated can update access requests"
ON public.lead_access_requests FOR UPDATE TO authenticated USING (true);

CREATE INDEX idx_lead_access_requests_lead ON public.lead_access_requests(lead_id);
CREATE INDEX idx_lead_access_requests_status ON public.lead_access_requests(status) WHERE status = 'pending';