
-- 1. Storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('staff-hub', 'staff-hub', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Documents metadata table
CREATE TABLE IF NOT EXISTS public.staff_hub_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  uploaded_by UUID,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_hub_documents_category ON public.staff_hub_documents(category);
CREATE INDEX IF NOT EXISTS idx_staff_hub_documents_created ON public.staff_hub_documents(created_at DESC);

ALTER TABLE public.staff_hub_documents ENABLE ROW LEVEL SECURITY;

-- 3. Helper to check if current user is super_admin via admin_users
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
      AND role = 'super_admin'
      AND is_active = true
  );
$$;

-- 4. RLS policies on staff_hub_documents — super_admin only for now
CREATE POLICY "Super admins can view staff hub documents"
  ON public.staff_hub_documents FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "Super admins can insert staff hub documents"
  ON public.staff_hub_documents FOR INSERT
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins can update staff hub documents"
  ON public.staff_hub_documents FOR UPDATE
  USING (public.is_super_admin());

CREATE POLICY "Super admins can delete staff hub documents"
  ON public.staff_hub_documents FOR DELETE
  USING (public.is_super_admin());

-- 5. updated_at trigger
CREATE OR REPLACE FUNCTION public.staff_hub_documents_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_staff_hub_documents_updated_at ON public.staff_hub_documents;
CREATE TRIGGER trg_staff_hub_documents_updated_at
BEFORE UPDATE ON public.staff_hub_documents
FOR EACH ROW EXECUTE FUNCTION public.staff_hub_documents_set_updated_at();

-- 6. Storage RLS policies for the private bucket — super_admin only
CREATE POLICY "Super admins can view staff-hub files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'staff-hub' AND public.is_super_admin());

CREATE POLICY "Super admins can upload staff-hub files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'staff-hub' AND public.is_super_admin());

CREATE POLICY "Super admins can update staff-hub files"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'staff-hub' AND public.is_super_admin());

CREATE POLICY "Super admins can delete staff-hub files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'staff-hub' AND public.is_super_admin());
