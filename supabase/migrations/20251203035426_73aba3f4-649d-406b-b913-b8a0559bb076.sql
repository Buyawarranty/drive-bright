-- Create video_play_tracking table
CREATE TABLE public.video_play_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id TEXT NOT NULL,
  video_title TEXT,
  page_url TEXT,
  user_agent TEXT,
  session_id TEXT,
  played_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  play_duration_seconds INTEGER,
  completed BOOLEAN DEFAULT false
);

-- Enable RLS
ALTER TABLE public.video_play_tracking ENABLE ROW LEVEL SECURITY;

-- Allow public inserts (for anonymous tracking)
CREATE POLICY "Anyone can log video plays"
ON public.video_play_tracking
FOR INSERT
WITH CHECK (true);

-- Admins can view all tracking data
CREATE POLICY "Admins can view video tracking"
ON public.video_play_tracking
FOR SELECT
USING (is_admin(auth.uid()));

-- Create index for analytics queries
CREATE INDEX idx_video_play_tracking_played_at ON public.video_play_tracking(played_at DESC);
CREATE INDEX idx_video_play_tracking_video_id ON public.video_play_tracking(video_id);