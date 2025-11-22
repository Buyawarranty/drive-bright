-- Create brevo_sync_log table to track all Brevo synchronization operations
CREATE TABLE public.brevo_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('cart_updated', 'order_completed', 'contact_created', 'contact_updated')),
  brevo_contact_id TEXT,
  event_data JSONB DEFAULT '{}'::jsonb,
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'success', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_brevo_sync_email ON public.brevo_sync_log(customer_email);
CREATE INDEX idx_brevo_sync_event ON public.brevo_sync_log(event_type);
CREATE INDEX idx_brevo_sync_status ON public.brevo_sync_log(sync_status);
CREATE INDEX idx_brevo_sync_created ON public.brevo_sync_log(created_at DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_brevo_sync_log_updated_at
  BEFORE UPDATE ON public.brevo_sync_log
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.brevo_sync_log ENABLE ROW LEVEL SECURITY;

-- Admin can view all sync logs
CREATE POLICY "Admins can view brevo sync logs"
  ON public.brevo_sync_log
  FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Service role can manage sync logs
CREATE POLICY "Service role can manage brevo sync logs"
  ON public.brevo_sync_log
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add optional brevo tracking fields to customers table
ALTER TABLE public.customers 
  ADD COLUMN IF NOT EXISTS brevo_contact_id TEXT,
  ADD COLUMN IF NOT EXISTS review_email_sent_at TIMESTAMPTZ;

-- Create index on brevo_contact_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_brevo_contact ON public.customers(brevo_contact_id);