
-- Create dealers table
CREATE TABLE public.dealers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dealers can view own profile"
  ON public.dealers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Dealers can update own profile"
  ON public.dealers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Dealers can insert own profile"
  ON public.dealers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create dealer_quotes table
CREATE TABLE public.dealer_quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dealer_id UUID REFERENCES public.dealers(id) ON DELETE CASCADE NOT NULL,
  customer_name TEXT NOT NULL,
  vehicle_reg TEXT NOT NULL,
  vehicle_make TEXT,
  vehicle_model TEXT,
  mileage TEXT,
  warranty_duration TEXT NOT NULL,
  plan_type TEXT NOT NULL,
  price NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.dealer_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dealers can view own quotes"
  ON public.dealer_quotes FOR SELECT
  USING (dealer_id IN (SELECT id FROM public.dealers WHERE user_id = auth.uid()));

CREATE POLICY "Dealers can create own quotes"
  ON public.dealer_quotes FOR INSERT
  WITH CHECK (dealer_id IN (SELECT id FROM public.dealers WHERE user_id = auth.uid()));

CREATE POLICY "Dealers can update own quotes"
  ON public.dealer_quotes FOR UPDATE
  USING (dealer_id IN (SELECT id FROM public.dealers WHERE user_id = auth.uid()));

CREATE POLICY "Dealers can delete own quotes"
  ON public.dealer_quotes FOR DELETE
  USING (dealer_id IN (SELECT id FROM public.dealers WHERE user_id = auth.uid()));

-- Create dealer_warranties table
CREATE TABLE public.dealer_warranties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID REFERENCES public.dealer_quotes(id) ON DELETE SET NULL,
  dealer_id UUID REFERENCES public.dealers(id) ON DELETE CASCADE NOT NULL,
  customer_name TEXT NOT NULL,
  vehicle_reg TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.dealer_warranties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dealers can view own warranties"
  ON public.dealer_warranties FOR SELECT
  USING (dealer_id IN (SELECT id FROM public.dealers WHERE user_id = auth.uid()));

CREATE POLICY "Dealers can create own warranties"
  ON public.dealer_warranties FOR INSERT
  WITH CHECK (dealer_id IN (SELECT id FROM public.dealers WHERE user_id = auth.uid()));

CREATE POLICY "Dealers can update own warranties"
  ON public.dealer_warranties FOR UPDATE
  USING (dealer_id IN (SELECT id FROM public.dealers WHERE user_id = auth.uid()));

-- Create updated_at triggers
CREATE TRIGGER update_dealers_updated_at
  BEFORE UPDATE ON public.dealers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dealer_quotes_updated_at
  BEFORE UPDATE ON public.dealer_quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dealer_warranties_updated_at
  BEFORE UPDATE ON public.dealer_warranties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_dealers_user_id ON public.dealers(user_id);
CREATE INDEX idx_dealer_quotes_dealer_id ON public.dealer_quotes(dealer_id);
CREATE INDEX idx_dealer_quotes_status ON public.dealer_quotes(status);
CREATE INDEX idx_dealer_warranties_dealer_id ON public.dealer_warranties(dealer_id);
CREATE INDEX idx_dealer_warranties_status ON public.dealer_warranties(status);
