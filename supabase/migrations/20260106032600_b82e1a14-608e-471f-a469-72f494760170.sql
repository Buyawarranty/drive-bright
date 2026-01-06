-- Create selling_tips table for sales team feedback and techniques
CREATE TABLE public.selling_tips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('selling_technique', 'word_phrase', 'missing_product', 'missing_service', 'website_feedback', 'user_need', 'other')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES public.admin_users(id),
  created_by UUID REFERENCES public.admin_users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.selling_tips ENABLE ROW LEVEL SECURITY;

-- Create policies for admin users
CREATE POLICY "Admin users can view all selling tips"
ON public.selling_tips
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admin users can create selling tips"
ON public.selling_tips
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admin users can update selling tips"
ON public.selling_tips
FOR UPDATE
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admin users can delete selling tips"
ON public.selling_tips
FOR DELETE
USING (public.is_admin(auth.uid()));

-- Add index for faster queries
CREATE INDEX idx_selling_tips_category ON public.selling_tips(category);
CREATE INDEX idx_selling_tips_created_at ON public.selling_tips(created_at DESC);
CREATE INDEX idx_selling_tips_is_pinned ON public.selling_tips(is_pinned DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_selling_tips_updated_at
BEFORE UPDATE ON public.selling_tips
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add comments
COMMENT ON TABLE public.selling_tips IS 'Sales team tips, techniques, and feedback for improving conversions';
COMMENT ON COLUMN public.selling_tips.category IS 'Type: selling_technique, word_phrase, missing_product, missing_service, website_feedback, user_need, other';