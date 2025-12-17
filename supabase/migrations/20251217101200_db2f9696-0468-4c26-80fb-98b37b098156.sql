-- Create claim_communications table for email thread tracking
CREATE TABLE public.claim_communications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    claim_id UUID NOT NULL REFERENCES public.claims_submissions(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    communication_type TEXT NOT NULL DEFAULT 'email' CHECK (communication_type IN ('email', 'phone', 'note')),
    subject TEXT,
    message TEXT NOT NULL,
    sender_email TEXT,
    recipient_email TEXT,
    sent_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create claim_tags table for color-coded status tags
CREATE TABLE public.claim_tags (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#6B7280',
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add tag_id to claims_submissions
ALTER TABLE public.claims_submissions 
ADD COLUMN IF NOT EXISTS tag_id UUID REFERENCES public.claim_tags(id),
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
ADD COLUMN IF NOT EXISTS follow_up_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMP WITH TIME ZONE;

-- Enable RLS
ALTER TABLE public.claim_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_tags ENABLE ROW LEVEL SECURITY;

-- RLS policies for claim_communications
CREATE POLICY "Admins can manage claim communications"
ON public.claim_communications FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Service role can manage claim communications"
ON public.claim_communications FOR ALL
USING (true)
WITH CHECK (true);

-- RLS policies for claim_tags
CREATE POLICY "Admins can manage claim tags"
ON public.claim_tags FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Service role can manage claim tags"
ON public.claim_tags FOR ALL
USING (true)
WITH CHECK (true);

-- Insert default claim tags (Monday.com style)
INSERT INTO public.claim_tags (name, color, description, sort_order) VALUES
('New', '#3B82F6', 'New claim awaiting review', 1),
('In Progress', '#F59E0B', 'Claim being processed', 2),
('Awaiting Info', '#8B5CF6', 'Waiting for customer information', 3),
('Under Review', '#06B6D4', 'Claim under detailed review', 4),
('Approved', '#10B981', 'Claim approved for payment', 5),
('Paid', '#059669', 'Payment completed', 6),
('Rejected', '#EF4444', 'Claim rejected', 7),
('On Hold', '#6B7280', 'Claim temporarily on hold', 8),
('Escalated', '#DC2626', 'Escalated to management', 9);

-- Create indexes for performance
CREATE INDEX idx_claim_communications_claim_id ON public.claim_communications(claim_id);
CREATE INDEX idx_claim_communications_created_at ON public.claim_communications(created_at DESC);
CREATE INDEX idx_claims_tag_id ON public.claims_submissions(tag_id);
CREATE INDEX idx_claims_priority ON public.claims_submissions(priority);
CREATE INDEX idx_claims_follow_up_date ON public.claims_submissions(follow_up_date);