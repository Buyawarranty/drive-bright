-- Create customer notes table
CREATE TABLE public.customer_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL,
  note_text TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create notes tags table
CREATE TABLE public.note_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#6b7280',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create junction table for note-tag relationships
CREATE TABLE public.customer_note_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID NOT NULL,
  tag_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(note_id, tag_id)
);

-- Create indexes for better performance
CREATE INDEX idx_customer_notes_customer_id ON public.customer_notes(customer_id);
CREATE INDEX idx_customer_notes_created_by ON public.customer_notes(created_by);
CREATE INDEX idx_customer_notes_pinned ON public.customer_notes(is_pinned) WHERE is_pinned = true;
CREATE INDEX idx_customer_note_tags_note_id ON public.customer_note_tags(note_id);
CREATE INDEX idx_customer_note_tags_tag_id ON public.customer_note_tags(tag_id);

-- Enable RLS
ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_note_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customer_notes
CREATE POLICY "Admins can manage customer notes" 
ON public.customer_notes FOR ALL 
USING (is_admin(auth.uid()));

-- RLS Policies for note_tags
CREATE POLICY "Admins can manage note tags" 
ON public.note_tags FOR ALL 
USING (is_admin(auth.uid()));

CREATE POLICY "Everyone can read active note tags" 
ON public.note_tags FOR SELECT 
USING (is_active = true);

-- RLS Policies for customer_note_tags
CREATE POLICY "Admins can manage note tag relationships" 
ON public.customer_note_tags FOR ALL 
USING (is_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_customer_notes_updated_at
  BEFORE UPDATE ON public.customer_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default tags
INSERT INTO public.note_tags (name, color, description) VALUES
('Call Back', '#ef4444', 'Needs follow-up call'),
('Meeting Scheduled', '#3b82f6', 'Future appointment booked'),
('Hot Lead', '#f59e0b', 'Strong buying intent'),
('Cold Lead', '#6b7280', 'Not ready/interested now'),
('New Inquiry', '#10b981', 'Just entered system'),
('Pricing Requested', '#8b5cf6', 'Customer asked for a quote'),
('Negotiation', '#f97316', 'In deal discussion'),
('Closed Won', '#22c55e', 'Converted to a sale'),
('Closed Lost', '#dc2626', 'Deal not successful'),
('Complaint', '#dc2626', 'Customer raised an issue'),
('Upsell Opportunity', '#059669', 'Potential to sell add-ons'),
('Renewal Due', '#d97706', 'Contract or warranty expiring soon'),
('VIP Client', '#7c3aed', 'High-value customer'),
('Do Not Contact', '#374151', 'Opted out'),
('Urgent', '#dc2626', 'Requires immediate attention'),
('Follow-up', '#f59e0b', 'Requires follow-up action');