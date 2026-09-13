ALTER TABLE public.whatsapp_auto_message_queue
  ADD COLUMN IF NOT EXISTS template_name text,
  ADD COLUMN IF NOT EXISTS force_send boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS batch_label text;

CREATE INDEX IF NOT EXISTS idx_wa_auto_queue_pending
  ON public.whatsapp_auto_message_queue (status, next_attempt_at);