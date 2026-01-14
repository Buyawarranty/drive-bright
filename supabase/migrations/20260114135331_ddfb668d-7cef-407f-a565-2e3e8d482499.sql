-- Create SMS consents table for tracking two-way SMS conversations
CREATE TABLE public.sms_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  normalized_phone TEXT NOT NULL UNIQUE,
  consent_status TEXT DEFAULT 'pending' CHECK (consent_status IN ('pending', 'opted_in', 'opted_out')),
  consent_given_at TIMESTAMPTZ,
  opted_out_at TIMESTAMPTZ,
  last_message_sent TEXT,
  last_message_received TEXT,
  last_interaction_at TIMESTAMPTZ,
  lead_id UUID REFERENCES public.sales_leads(id) ON DELETE SET NULL,
  abandoned_cart_id UUID REFERENCES public.abandoned_carts(id) ON DELETE SET NULL,
  customer_name TEXT,
  vehicle_info TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast webhook lookups by phone
CREATE INDEX idx_sms_consents_normalized_phone ON public.sms_consents(normalized_phone);
CREATE INDEX idx_sms_consents_consent_status ON public.sms_consents(consent_status);

-- Enable RLS
ALTER TABLE public.sms_consents ENABLE ROW LEVEL SECURITY;

-- RLS policies for admin access
CREATE POLICY "Allow anon insert for webhook" ON public.sms_consents
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anon update for webhook" ON public.sms_consents
  FOR UPDATE USING (true);

CREATE POLICY "Allow anon select for webhook" ON public.sms_consents
  FOR SELECT USING (true);

-- Trigger to update updated_at
CREATE TRIGGER update_sms_consents_updated_at
  BEFORE UPDATE ON public.sms_consents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();