
CREATE TYPE public.complaint_status AS ENUM ('new','acknowledged','in_progress','resolved','closed');

CREATE TABLE public.complaints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  warranty_ref TEXT,
  registration_plate TEXT,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  desired_outcome TEXT,
  status public.complaint_status NOT NULL DEFAULT 'new',
  assigned_to UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  internal_notes TEXT,
  resolution TEXT,
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.complaints TO anon;
GRANT SELECT, INSERT, UPDATE ON public.complaints TO authenticated;
GRANT ALL ON public.complaints TO service_role;

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a complaint"
ON public.complaints FOR INSERT
WITH CHECK (true);

CREATE POLICY "Staff can view complaints"
ON public.complaints FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid()
      AND au.is_active = true
      AND au.role IN ('super_admin','admin','claims_agent','claims_manager')
  )
);

CREATE POLICY "Staff can update complaints"
ON public.complaints FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid()
      AND au.is_active = true
      AND au.role IN ('super_admin','admin','claims_agent','claims_manager')
  )
);

CREATE TRIGGER update_complaints_updated_at
BEFORE UPDATE ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_complaints_status ON public.complaints(status);
CREATE INDEX idx_complaints_created_at ON public.complaints(created_at DESC);
CREATE INDEX idx_complaints_assigned_to ON public.complaints(assigned_to);
