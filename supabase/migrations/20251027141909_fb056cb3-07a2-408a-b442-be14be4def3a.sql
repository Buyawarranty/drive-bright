-- Create customer tags table
CREATE TABLE IF NOT EXISTS public.customer_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6B7280',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create customer tag assignments junction table
CREATE TABLE IF NOT EXISTS public.customer_tag_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.customer_tags(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(customer_id, tag_id)
);

-- Enable RLS
ALTER TABLE public.customer_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_tag_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customer_tags
CREATE POLICY "Admins can manage customer tags"
  ON public.customer_tags
  FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Service role can manage customer tags"
  ON public.customer_tags
  FOR ALL
  USING (true);

-- RLS Policies for customer_tag_assignments
CREATE POLICY "Admins can manage tag assignments"
  ON public.customer_tag_assignments
  FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Service role can manage tag assignments"
  ON public.customer_tag_assignments
  FOR ALL
  USING (true);

-- Create indexes for better performance
CREATE INDEX idx_customer_tag_assignments_customer_id ON public.customer_tag_assignments(customer_id);
CREATE INDEX idx_customer_tag_assignments_tag_id ON public.customer_tag_assignments(tag_id);
CREATE INDEX idx_customer_tags_category ON public.customer_tags(category);

-- Insert predefined tags
INSERT INTO public.customer_tags (name, category, color) VALUES
  -- Payment Status
  ('Payment Due', 'Payment Status', '#EF4444'),
  ('Paid', 'Payment Status', '#10B981'),
  ('Partially Paid', 'Payment Status', '#F59E0B'),
  ('Refunded', 'Payment Status', '#8B5CF6'),
  ('Payment Failed', 'Payment Status', '#DC2626'),
  ('Awaiting Bank Transfer', 'Payment Status', '#F59E0B'),
  ('Direct Debit Setup Pending', 'Payment Status', '#3B82F6'),
  ('Invoice Sent', 'Payment Status', '#6366F1'),
  ('Payment Overdue', 'Payment Status', '#B91C1C'),
  
  -- Follow-Up Actions
  ('Call Back Requested', 'Follow-Up Actions', '#06B6D4'),
  ('Call Back Scheduled', 'Follow-Up Actions', '#0EA5E9'),
  ('Left Voicemail', 'Follow-Up Actions', '#8B5CF6'),
  ('Follow-Up Email Sent', 'Follow-Up Actions', '#6366F1'),
  ('No Response', 'Follow-Up Actions', '#6B7280'),
  ('Interested – Awaiting Decision', 'Follow-Up Actions', '#F59E0B'),
  ('Not Interested', 'Follow-Up Actions', '#EF4444'),
  ('Needs More Info', 'Follow-Up Actions', '#14B8A6'),
  ('Escalated to Manager', 'Follow-Up Actions', '#DC2626'),
  
  -- Sales Funnel
  ('New Lead', 'Sales Funnel', '#10B981'),
  ('Quote Sent', 'Sales Funnel', '#3B82F6'),
  ('Quote Accepted', 'Sales Funnel', '#059669'),
  ('Quote Declined', 'Sales Funnel', '#EF4444'),
  ('Warranty Activated', 'Sales Funnel', '#10B981'),
  ('Warranty Expired', 'Sales Funnel', '#6B7280'),
  ('Renewal Due', 'Sales Funnel', '#F59E0B'),
  ('Renewal Confirmed', 'Sales Funnel', '#10B981'),
  
  -- Customer Type
  ('Repeat Customer', 'Customer Type', '#8B5CF6'),
  ('First-Time Buyer', 'Customer Type', '#06B6D4'),
  ('Fleet Owner', 'Customer Type', '#F59E0B'),
  ('Trade Partner', 'Customer Type', '#3B82F6'),
  ('Referral', 'Customer Type', '#10B981')
ON CONFLICT (name) DO NOTHING;

-- Create trigger for updated_at
CREATE TRIGGER update_customer_tags_updated_at
  BEFORE UPDATE ON public.customer_tags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();