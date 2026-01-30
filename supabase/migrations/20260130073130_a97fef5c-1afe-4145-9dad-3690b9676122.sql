-- Create whatsapp_message_log table for tracking WhatsApp messages
CREATE TABLE public.whatsapp_message_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.sales_leads(id) ON DELETE SET NULL,
  abandoned_cart_id UUID REFERENCES public.abandoned_carts(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  normalized_phone TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'welcome',
  status TEXT NOT NULL DEFAULT 'pending',
  uchat_response JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for deduplication checks
CREATE INDEX idx_whatsapp_log_phone_type ON public.whatsapp_message_log(normalized_phone, message_type, status);
CREATE INDEX idx_whatsapp_log_created ON public.whatsapp_message_log(created_at DESC);

-- Enable RLS
ALTER TABLE public.whatsapp_message_log ENABLE ROW LEVEL SECURITY;

-- Admin-only access policy
CREATE POLICY "Admin users can view whatsapp logs" ON public.whatsapp_message_log
  FOR SELECT USING (public.is_admin(auth.uid()));

-- Admin can insert logs (for edge functions using service role, this won't apply)
CREATE POLICY "Admin users can insert whatsapp logs" ON public.whatsapp_message_log
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));