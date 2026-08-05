CREATE TABLE public.customer_part_payment_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  total_due NUMERIC(10,2) NOT NULL DEFAULT 0,
  next_due_date DATE,
  status TEXT NOT NULL DEFAULT 'in_progress',
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (customer_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_part_payment_plans TO authenticated;
GRANT ALL ON public.customer_part_payment_plans TO service_role;
ALTER TABLE public.customer_part_payment_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view part payment plans"
  ON public.customer_part_payment_plans FOR SELECT TO authenticated
  USING (public.is_staff());
CREATE POLICY "Staff can create part payment plans"
  ON public.customer_part_payment_plans FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());
CREATE POLICY "Staff can update part payment plans"
  ON public.customer_part_payment_plans FOR UPDATE TO authenticated
  USING (public.is_staff());
CREATE POLICY "Management can delete part payment plans"
  ON public.customer_part_payment_plans FOR DELETE TO authenticated
  USING (public.is_management(auth.uid()));

CREATE TABLE public.customer_part_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'other',
  paid_on DATE NOT NULL DEFAULT CURRENT_DATE,
  reference TEXT,
  proof_url TEXT,
  notes TEXT,
  recorded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_part_payments TO authenticated;
GRANT ALL ON public.customer_part_payments TO service_role;
ALTER TABLE public.customer_part_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view part payments"
  ON public.customer_part_payments FOR SELECT TO authenticated
  USING (public.is_staff());
CREATE POLICY "Staff can create part payments"
  ON public.customer_part_payments FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());
CREATE POLICY "Staff can update part payments"
  ON public.customer_part_payments FOR UPDATE TO authenticated
  USING (public.is_staff());
CREATE POLICY "Management can delete part payments"
  ON public.customer_part_payments FOR DELETE TO authenticated
  USING (public.is_management(auth.uid()));

CREATE INDEX idx_customer_part_payments_customer ON public.customer_part_payments(customer_id, paid_on DESC);
CREATE INDEX idx_part_payment_plans_status ON public.customer_part_payment_plans(status, next_due_date);

CREATE TRIGGER update_part_payment_plans_updated_at
  BEFORE UPDATE ON public.customer_part_payment_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_part_payments_updated_at
  BEFORE UPDATE ON public.customer_part_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Staff can read part payment proofs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'part-payment-proofs' AND public.is_staff());
CREATE POLICY "Staff can upload part payment proofs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'part-payment-proofs' AND public.is_staff());
CREATE POLICY "Staff can update part payment proofs"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'part-payment-proofs' AND public.is_staff());