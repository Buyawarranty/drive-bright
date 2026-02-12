
-- Create claim_quick_notes table (mirroring lead_quick_notes)
CREATE TABLE public.claim_quick_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  claim_id UUID NOT NULL REFERENCES public.claims_submissions(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.claim_quick_notes ENABLE ROW LEVEL SECURITY;

-- RLS policies: any authenticated admin can CRUD claim notes
CREATE POLICY "Authenticated users can view claim notes"
  ON public.claim_quick_notes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert claim notes"
  ON public.claim_quick_notes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update claim notes"
  ON public.claim_quick_notes FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete claim notes"
  ON public.claim_quick_notes FOR DELETE
  TO authenticated
  USING (true);

-- Index for fast lookups
CREATE INDEX idx_claim_quick_notes_claim_id ON public.claim_quick_notes(claim_id);

-- Update trigger
CREATE TRIGGER update_claim_quick_notes_updated_at
  BEFORE UPDATE ON public.claim_quick_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
