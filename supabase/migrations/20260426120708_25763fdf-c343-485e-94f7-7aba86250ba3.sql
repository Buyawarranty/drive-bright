
-- Timestamped notes for claims (claims_submissions)
CREATE TABLE IF NOT EXISTS public.claim_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  claim_id UUID NOT NULL REFERENCES public.claims_submissions(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by UUID,            -- auth.users.id of the staff member who wrote the note
  created_by_name TEXT,       -- snapshot of the staff name at time of writing
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claim_notes_claim_id ON public.claim_notes(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_notes_created_at ON public.claim_notes(created_at DESC);

ALTER TABLE public.claim_notes ENABLE ROW LEVEL SECURITY;

-- Helper: only active admin staff can read/write claim notes
-- (mirrors the access pattern used by other admin-only tables in this project)
DROP POLICY IF EXISTS "Admin staff can view claim notes" ON public.claim_notes;
CREATE POLICY "Admin staff can view claim notes"
ON public.claim_notes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid() AND au.is_active = true
  )
);

DROP POLICY IF EXISTS "Admin staff can insert claim notes" ON public.claim_notes;
CREATE POLICY "Admin staff can insert claim notes"
ON public.claim_notes
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid() AND au.is_active = true
  )
);

DROP POLICY IF EXISTS "Authors can update own claim notes" ON public.claim_notes;
CREATE POLICY "Authors can update own claim notes"
ON public.claim_notes
FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Authors and admins can delete claim notes" ON public.claim_notes;
CREATE POLICY "Authors and admins can delete claim notes"
ON public.claim_notes
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid()
      AND au.is_active = true
      AND au.role IN ('admin','super_admin')
  )
);
