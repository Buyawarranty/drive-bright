ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS opted_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS opt_out_reason text;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_opted_out_at ON public.whatsapp_conversations (opted_out_at);