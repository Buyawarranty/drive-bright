
CREATE TABLE public.claim_email_retry_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID REFERENCES public.claims_submissions(id) ON DELETE SET NULL,
  email_kind TEXT NOT NULL CHECK (email_kind IN ('internal_notification','customer_confirmation')),
  payload JSONB NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 6,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  last_error TEXT,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_claim_email_retry_queue_pending
  ON public.claim_email_retry_queue (status, next_attempt_at)
  WHERE status = 'pending';

CREATE INDEX idx_claim_email_retry_queue_submission
  ON public.claim_email_retry_queue (submission_id);

GRANT SELECT ON public.claim_email_retry_queue TO authenticated;
GRANT ALL ON public.claim_email_retry_queue TO service_role;

ALTER TABLE public.claim_email_retry_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view claim email retry queue"
  ON public.claim_email_retry_queue
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_claim_email_retry_queue_updated_at
  BEFORE UPDATE ON public.claim_email_retry_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
