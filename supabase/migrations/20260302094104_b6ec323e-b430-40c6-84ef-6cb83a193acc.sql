
-- Commission claims table for agents to claim credit on online sales
CREATE TABLE public.commission_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  lead_id UUID, -- optional reference to sales_leads
  agent_id UUID REFERENCES public.admin_users(id) ON DELETE CASCADE NOT NULL,
  claim_reason TEXT NOT NULL, -- 'phone_call', 'email_follow_up', 'quote_sent', 'whatsapp', 'other'
  claim_notes TEXT, -- mandatory explanation
  evidence_type TEXT, -- 'call_log', 'email_thread', 'quote_reference', 'other'
  deal_value NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  reviewed_by UUID REFERENCES public.admin_users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.commission_claims ENABLE ROW LEVEL SECURITY;

-- Agents can view their own claims
CREATE POLICY "Agents can view own claims"
  ON public.commission_claims FOR SELECT
  TO authenticated
  USING (
    agent_id IN (SELECT id FROM admin_users WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Agents can insert their own claims
CREATE POLICY "Agents can insert own claims"
  ON public.commission_claims FOR INSERT
  TO authenticated
  WITH CHECK (
    agent_id IN (SELECT id FROM admin_users WHERE user_id = auth.uid())
  );

-- Admins can update (approve/reject)
CREATE POLICY "Admins can update claims"
  ON public.commission_claims FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Updated_at trigger
CREATE TRIGGER update_commission_claims_updated_at
  BEFORE UPDATE ON public.commission_claims
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
