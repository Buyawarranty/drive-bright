ALTER TABLE public.whatsapp_auto_message_settings
  ADD COLUMN IF NOT EXISTS away_reply_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS away_reply_text text NOT NULL DEFAULT 'Thanks for your message! Our team is currently closed. We''re open Monday to Friday, 9am to 5pm, and will reply as soon as we''re back.',
  ADD COLUMN IF NOT EXISTS office_open_time time NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS office_close_time time NOT NULL DEFAULT '17:00',
  ADD COLUMN IF NOT EXISTS away_weekends_closed boolean NOT NULL DEFAULT true;

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS last_away_reply_at timestamptz;