-- Create the lead_quick_notes table
CREATE TABLE IF NOT EXISTS public.lead_quick_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  created_by UUID NOT NULL REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_quick_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies: All active admin users can read/write quick notes
CREATE POLICY "Admin users can view all quick notes" 
  ON public.lead_quick_notes FOR SELECT 
  TO authenticated 
  USING (EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() AND admin_users.is_active = true
  ));

CREATE POLICY "Admin users can insert quick notes"
  ON public.lead_quick_notes FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() AND admin_users.is_active = true
  ));

CREATE POLICY "Admin users can update quick notes"
  ON public.lead_quick_notes FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() AND admin_users.is_active = true
  ));

CREATE POLICY "Admin users can delete quick notes"
  ON public.lead_quick_notes FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid() AND admin_users.is_active = true
  ));

-- Create index for faster lookups
CREATE INDEX idx_lead_quick_notes_lead_id ON public.lead_quick_notes(lead_id);

-- Create trigger for updated_at
CREATE TRIGGER update_lead_quick_notes_updated_at
  BEFORE UPDATE ON public.lead_quick_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();