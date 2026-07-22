
CREATE TABLE IF NOT EXISTS public.orr_config (
  id            boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  timezone      text NOT NULL DEFAULT 'Europe/London',
  work_start    time NOT NULL DEFAULT '09:00',
  live_cutoff   time NOT NULL DEFAULT '17:30',
  work_end      time NOT NULL DEFAULT '18:00',
  weekend_days  int[] NOT NULL DEFAULT ARRAY[6,0],
  updated_at    timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.orr_config TO authenticated;
GRANT ALL ON public.orr_config TO service_role;
ALTER TABLE public.orr_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orr_config readable by staff" ON public.orr_config;
CREATE POLICY "orr_config readable by staff" ON public.orr_config
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "orr_config manageable by management" ON public.orr_config;
CREATE POLICY "orr_config manageable by management" ON public.orr_config
  FOR ALL TO authenticated
  USING (public.is_management(auth.uid()))
  WITH CHECK (public.is_management(auth.uid()));
INSERT INTO public.orr_config (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.orr_exceptional_closures (
  closure_date  date PRIMARY KEY,
  reason        text,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.orr_exceptional_closures TO authenticated;
GRANT ALL ON public.orr_exceptional_closures TO service_role;
ALTER TABLE public.orr_exceptional_closures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "closures readable by staff" ON public.orr_exceptional_closures;
CREATE POLICY "closures readable by staff" ON public.orr_exceptional_closures
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "closures manageable by management" ON public.orr_exceptional_closures;
CREATE POLICY "closures manageable by management" ON public.orr_exceptional_closures
  FOR ALL TO authenticated
  USING (public.is_management(auth.uid()))
  WITH CHECK (public.is_management(auth.uid()));

ALTER TABLE public.sales_leads
  ADD COLUMN IF NOT EXISTS intake_class text
    CHECK (intake_class IN ('live','overnight')),
  ADD COLUMN IF NOT EXISTS eligible_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_sales_leads_intake_eligible
  ON public.sales_leads (intake_class, eligible_at)
  WHERE intake_class IS NOT NULL;

CREATE OR REPLACE FUNCTION public.orr_is_business_day(_d date)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_weekend int[];
BEGIN
  SELECT weekend_days INTO v_weekend FROM public.orr_config WHERE id = true;
  IF EXTRACT(dow FROM _d)::int = ANY (v_weekend) THEN
    RETURN false;
  END IF;
  IF EXISTS (SELECT 1 FROM public.uk_bank_holidays WHERE holiday_date = _d) THEN
    RETURN false;
  END IF;
  IF EXISTS (SELECT 1 FROM public.orr_exceptional_closures WHERE closure_date = _d) THEN
    RETURN false;
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.orr_next_business_open(_ts timestamptz)
RETURNS timestamptz LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cfg       public.orr_config%ROWTYPE;
  v_local     timestamp;
  v_date      date;
  v_candidate timestamp;
BEGIN
  SELECT * INTO v_cfg FROM public.orr_config WHERE id = true;
  v_local := (_ts AT TIME ZONE v_cfg.timezone);
  v_date  := v_local::date;

  IF public.orr_is_business_day(v_date) AND v_local::time < v_cfg.work_start THEN
    v_candidate := (v_date + v_cfg.work_start)::timestamp;
    RETURN v_candidate AT TIME ZONE v_cfg.timezone;
  END IF;

  v_date := v_date + 1;
  WHILE NOT public.orr_is_business_day(v_date) LOOP
    v_date := v_date + 1;
  END LOOP;
  v_candidate := (v_date + v_cfg.work_start)::timestamp;
  RETURN v_candidate AT TIME ZONE v_cfg.timezone;
END;
$$;

CREATE OR REPLACE FUNCTION public.orr_classify_intake(_arrived_at timestamptz)
RETURNS TABLE (intake_class text, eligible_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cfg   public.orr_config%ROWTYPE;
  v_local timestamp;
  v_date  date;
  v_time  time;
BEGIN
  SELECT * INTO v_cfg FROM public.orr_config WHERE id = true;
  v_local := (_arrived_at AT TIME ZONE v_cfg.timezone);
  v_date  := v_local::date;
  v_time  := v_local::time;

  IF public.orr_is_business_day(v_date) AND v_time >= v_cfg.work_start AND v_time < v_cfg.live_cutoff THEN
    intake_class := 'live';
    eligible_at  := _arrived_at;
  ELSE
    intake_class := 'overnight';
    eligible_at  := public.orr_next_business_open(_arrived_at);
  END IF;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.sales_leads_classify_intake()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_team_blue uuid;
  v_is_blue   boolean := false;
  v_res       record;
BEGIN
  IF NEW.intake_class IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_team_blue FROM public.lead_teams WHERE lower(name) = 'blue' LIMIT 1;
  IF v_team_blue IS NULL THEN RETURN NEW; END IF;

  IF NEW.team_id = v_team_blue THEN
    v_is_blue := true;
  ELSIF NEW.assigned_to IS NOT NULL AND public.is_agent_on_team_blue(NEW.assigned_to) THEN
    v_is_blue := true;
  END IF;

  IF NOT v_is_blue THEN RETURN NEW; END IF;

  SELECT * INTO v_res FROM public.orr_classify_intake(COALESCE(NEW.created_at, now()));
  NEW.intake_class := v_res.intake_class;
  NEW.eligible_at  := v_res.eligible_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_leads_classify_intake ON public.sales_leads;
CREATE TRIGGER trg_sales_leads_classify_intake
  BEFORE INSERT ON public.sales_leads
  FOR EACH ROW EXECUTE FUNCTION public.sales_leads_classify_intake();
