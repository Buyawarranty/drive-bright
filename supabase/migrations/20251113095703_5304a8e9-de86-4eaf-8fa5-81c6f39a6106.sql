-- Create audit log table for Warranties 2000 manual resends
CREATE TABLE IF NOT EXISTS public.warranties_2000_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID REFERENCES public.customer_policies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  admin_user_id UUID REFERENCES auth.users(id),
  admin_email TEXT,
  action_type TEXT NOT NULL, -- 'manual_resend', 'initial_send', 'update'
  data_sent JSONB NOT NULL, -- Store what was actually sent to W2K
  w2k_response JSONB, -- Store the response from W2K API
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.warranties_2000_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all audit logs
CREATE POLICY "Admins can view all W2K audit logs"
  ON public.warranties_2000_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'member', 'viewer')
    )
  );

-- Policy: Admins can insert audit logs
CREATE POLICY "Admins can insert W2K audit logs"
  ON public.warranties_2000_audit_log
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'member')
    )
  );

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_w2k_audit_policy_id ON public.warranties_2000_audit_log(policy_id);
CREATE INDEX IF NOT EXISTS idx_w2k_audit_customer_id ON public.warranties_2000_audit_log(customer_id);
CREATE INDEX IF NOT EXISTS idx_w2k_audit_created_at ON public.warranties_2000_audit_log(created_at DESC);