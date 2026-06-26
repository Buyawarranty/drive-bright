
ALTER TABLE public.sales_leads
  ADD COLUMN IF NOT EXISTS do_not_contact BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS do_not_contact_reason TEXT,
  ADD COLUMN IF NOT EXISTS do_not_contact_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS do_not_contact_by UUID;

CREATE INDEX IF NOT EXISTS sales_leads_do_not_contact_idx ON public.sales_leads(do_not_contact) WHERE do_not_contact = true;
