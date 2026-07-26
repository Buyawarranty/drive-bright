CREATE TABLE public.sms_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  message text,
  message_type text,
  success boolean NOT NULL DEFAULT false,
  http_status integer,
  clicksend_message_id text,
  clicksend_status text,
  cost numeric,
  error_message text,
  raw_response jsonb,
  customer_id uuid,
  lead_id uuid,
  triggered_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sms_send_log TO authenticated;
GRANT ALL ON public.sms_send_log TO service_role;

ALTER TABLE public.sms_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sms send log"
ON public.sms_send_log FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid()
      AND au.is_active = true
      AND au.role IN ('admin','super_admin','sales_manager')
  )
);

CREATE INDEX idx_sms_send_log_created_at ON public.sms_send_log (created_at DESC);
CREATE INDEX idx_sms_send_log_phone ON public.sms_send_log (phone);