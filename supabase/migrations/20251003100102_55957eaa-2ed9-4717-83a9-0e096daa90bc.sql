-- Add missing columns to email_logs table
ALTER TABLE public.email_logs 
ADD COLUMN IF NOT EXISTS resend_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_resent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS recipient_name TEXT,
ADD COLUMN IF NOT EXISTS content TEXT,
ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'complained')),
ADD COLUMN IF NOT EXISTS opened_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS failed_reason TEXT;