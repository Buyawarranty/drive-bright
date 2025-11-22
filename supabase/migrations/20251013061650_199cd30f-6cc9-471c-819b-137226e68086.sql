-- Add additional columns to claims_submissions for comprehensive claim tracking
ALTER TABLE public.claims_submissions 
ADD COLUMN IF NOT EXISTS vehicle_registration text,
ADD COLUMN IF NOT EXISTS warranty_type text,
ADD COLUMN IF NOT EXISTS payment_amount numeric(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS claim_reason text,
ADD COLUMN IF NOT EXISTS internal_notes text,
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS rejected_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS rejection_reason text,
ADD COLUMN IF NOT EXISTS date_of_incident timestamp with time zone,
ADD COLUMN IF NOT EXISTS mileage_at_claim integer;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_claims_created_at ON public.claims_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_claims_status ON public.claims_submissions(status);
CREATE INDEX IF NOT EXISTS idx_claims_vehicle_reg ON public.claims_submissions(vehicle_registration);

-- Create a view for monthly claims statistics
CREATE OR REPLACE VIEW public.monthly_claims_stats AS
SELECT 
  DATE_TRUNC('month', created_at) as month,
  COUNT(*) as total_claims,
  COUNT(*) FILTER (WHERE status = 'approved' OR paid_at IS NOT NULL) as approved_claims,
  COUNT(*) FILTER (WHERE status = 'rejected') as rejected_claims,
  COALESCE(SUM(payment_amount) FILTER (WHERE paid_at IS NOT NULL), 0) as total_paid,
  COALESCE(AVG(payment_amount) FILTER (WHERE paid_at IS NOT NULL), 0) as avg_claim_value
FROM public.claims_submissions
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;

-- Update existing status values to include new statuses
-- We'll keep: new, in_progress, resolved, approved, rejected, awaiting_info, paid

-- Add RLS policy for the view
ALTER VIEW public.monthly_claims_stats SET (security_invoker = true);

-- Create policy to allow admins to view monthly stats
CREATE POLICY "Admins can view monthly stats"
  ON public.claims_submissions
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

COMMENT ON TABLE public.claims_submissions IS 'Stores all customer claim submissions from the website claims form and email';
COMMENT ON VIEW public.monthly_claims_stats IS 'Monthly aggregated statistics for claims management dashboard';