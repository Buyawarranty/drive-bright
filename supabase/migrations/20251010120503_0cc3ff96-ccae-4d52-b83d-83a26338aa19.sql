-- Add email tracking columns to email_logs table
ALTER TABLE public.email_logs 
ADD COLUMN IF NOT EXISTS open_tracked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS click_tracked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS conversion_tracked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS tracking_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
ADD COLUMN IF NOT EXISTS utm_source TEXT,
ADD COLUMN IF NOT EXISTS utm_medium TEXT,
ADD COLUMN IF NOT EXISTS utm_content TEXT,
ADD COLUMN IF NOT EXISTS meta_pixel_tracked BOOLEAN DEFAULT FALSE;

-- Create index for tracking lookups
CREATE INDEX IF NOT EXISTS idx_email_logs_tracking_id ON public.email_logs(tracking_id);

-- Create email tracking events table for detailed analytics
CREATE TABLE IF NOT EXISTS public.email_tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_log_id UUID REFERENCES public.email_logs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'open', 'click', 'conversion'
  event_data JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for analytics queries
CREATE INDEX IF NOT EXISTS idx_tracking_events_log_id ON public.email_tracking_events(email_log_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_type ON public.email_tracking_events(event_type);
CREATE INDEX IF NOT EXISTS idx_tracking_events_created ON public.email_tracking_events(created_at);

-- Enable RLS on tracking events
ALTER TABLE public.email_tracking_events ENABLE ROW LEVEL SECURITY;

-- Allow public to insert tracking events (for tracking pixels)
CREATE POLICY "Allow public to track email events"
ON public.email_tracking_events
FOR INSERT
TO anon
WITH CHECK (true);

-- Admins can view all tracking events
CREATE POLICY "Admins can view tracking events"
ON public.email_tracking_events
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Service role can manage tracking events
CREATE POLICY "Service role can manage tracking events"
ON public.email_tracking_events
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);