
-- Create page_views table to track website visitor analytics
CREATE TABLE public.page_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_path TEXT NOT NULL,
  page_title TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  gclid TEXT,
  user_agent TEXT,
  screen_width INTEGER,
  screen_height INTEGER,
  session_id TEXT,
  visitor_id TEXT,
  is_google_ads BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (tracking from public website)
CREATE POLICY "Allow anonymous page view inserts"
  ON public.page_views
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins can read page views
CREATE POLICY "Admins can view page analytics"
  ON public.page_views
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND role IN ('admin', 'dev_tester')
    )
  );

-- Create indexes for common queries
CREATE INDEX idx_page_views_page_path ON public.page_views (page_path);
CREATE INDEX idx_page_views_created_at ON public.page_views (created_at DESC);
CREATE INDEX idx_page_views_is_google_ads ON public.page_views (is_google_ads);
CREATE INDEX idx_page_views_session_id ON public.page_views (session_id);
CREATE INDEX idx_page_views_visitor_id ON public.page_views (visitor_id);
