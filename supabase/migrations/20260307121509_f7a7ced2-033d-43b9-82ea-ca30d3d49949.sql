
CREATE TABLE public.posted_letters_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  registration_plate TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  warranty_number TEXT,
  plan_type TEXT,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  marked_sent_by TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.posted_letters_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin users can manage posted letters log"
  ON public.posted_letters_log
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND role IN ('admin', 'sales', 'sales_lead')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND role IN ('admin', 'sales', 'sales_lead')
    )
  );

CREATE INDEX idx_posted_letters_reg ON public.posted_letters_log(registration_plate);
CREATE INDEX idx_posted_letters_sent_at ON public.posted_letters_log(sent_at DESC);
