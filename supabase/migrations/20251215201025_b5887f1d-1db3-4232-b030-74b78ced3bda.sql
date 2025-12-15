-- Create enum for interaction types
CREATE TYPE public.interaction_type AS ENUM ('call', 'email', 'chat', 'in_person');

-- Create enum for note purposes
CREATE TYPE public.note_purpose AS ENUM ('claim_query', 'sales_enquiry', 'cancellation', 'renewal', 'payment', 'general', 'complaint');

-- Create enum for risk levels
CREATE TYPE public.risk_level AS ENUM ('low', 'medium', 'high');

-- Create structured customer notes table
CREATE TABLE public.structured_customer_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  policy_number TEXT,
  vehicle_reg TEXT,
  
  -- Note content
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  actions_taken JSONB DEFAULT '[]'::jsonb,
  next_steps JSONB DEFAULT '[]'::jsonb,
  deadlines JSONB DEFAULT '[]'::jsonb,
  compliance_notes TEXT,
  risk_level public.risk_level DEFAULT 'low',
  risk_reason TEXT,
  tags TEXT[] DEFAULT '{}',
  
  -- Context
  interaction_type public.interaction_type,
  purpose public.note_purpose,
  interaction_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- References
  claim_reference TEXT,
  call_recording_id TEXT,
  document_ids TEXT[],
  
  -- Audit
  created_by UUID REFERENCES public.admin_users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID REFERENCES public.admin_users(id)
);

-- Enable RLS
ALTER TABLE public.structured_customer_notes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage structured notes"
ON public.structured_customer_notes
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Service role can manage structured notes"
ON public.structured_customer_notes
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for search
CREATE INDEX idx_structured_notes_customer ON public.structured_customer_notes(customer_id);
CREATE INDEX idx_structured_notes_tags ON public.structured_customer_notes USING GIN(tags);
CREATE INDEX idx_structured_notes_risk ON public.structured_customer_notes(risk_level);
CREATE INDEX idx_structured_notes_policy ON public.structured_customer_notes(policy_number);
CREATE INDEX idx_structured_notes_vehicle ON public.structured_customer_notes(vehicle_reg);

-- Trigger for updated_at
CREATE TRIGGER update_structured_notes_updated_at
BEFORE UPDATE ON public.structured_customer_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();