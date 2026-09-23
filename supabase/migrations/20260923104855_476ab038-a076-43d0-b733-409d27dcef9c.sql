ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS baw_paylater BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS baw_paylater_years INTEGER,
  ADD COLUMN IF NOT EXISTS baw_paylater_yearly_amount NUMERIC(10,2);

CREATE TABLE IF NOT EXISTS public.baw_paylater_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  warranty_reference_number TEXT,
  year_number INTEGER NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMP WITH TIME ZONE,
  paid_amount NUMERIC(10,2),
  payment_reference TEXT,
  payment_method TEXT,
  chase_count INTEGER NOT NULL DEFAULT 0,
  last_chased_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (customer_id, year_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.baw_paylater_schedules TO authenticated;
GRANT ALL ON public.baw_paylater_schedules TO service_role;
ALTER TABLE public.baw_paylater_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view paylater schedules"
  ON public.baw_paylater_schedules FOR SELECT TO authenticated
  USING (public.is_staff());
CREATE POLICY "Customers can view own paylater schedules"
  ON public.baw_paylater_schedules FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = baw_paylater_schedules.customer_id
      AND lower(c.email) = lower((SELECT auth.email()))
  ));
CREATE POLICY "Staff can create paylater schedules"
  ON public.baw_paylater_schedules FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());
CREATE POLICY "Staff can update paylater schedules"
  ON public.baw_paylater_schedules FOR UPDATE TO authenticated
  USING (public.is_staff());
CREATE POLICY "Management can delete paylater schedules"
  ON public.baw_paylater_schedules FOR DELETE TO authenticated
  USING (public.is_management(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_baw_paylater_due ON public.baw_paylater_schedules(status, due_date);
CREATE INDEX IF NOT EXISTS idx_baw_paylater_customer ON public.baw_paylater_schedules(customer_id, year_number);

CREATE TRIGGER update_baw_paylater_schedules_updated_at
  BEFORE UPDATE ON public.baw_paylater_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();