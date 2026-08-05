CREATE TABLE public.offline_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  campaign_type text NOT NULL DEFAULT 'banner',
  location text,
  postcode_prefixes text[] NOT NULL DEFAULT '{}',
  install_date date NOT NULL,
  end_date date,
  monthly_cost numeric DEFAULT 0,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.offline_campaigns TO authenticated;
GRANT ALL ON public.offline_campaigns TO service_role;

ALTER TABLE public.offline_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view offline campaigns"
ON public.offline_campaigns FOR SELECT TO authenticated
USING (public.is_staff());

CREATE POLICY "Management can manage offline campaigns"
ON public.offline_campaigns FOR ALL TO authenticated
USING (public.is_management(auth.uid()))
WITH CHECK (public.is_management(auth.uid()));

CREATE TRIGGER trg_offline_campaigns_updated_at
BEFORE UPDATE ON public.offline_campaigns
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.offline_campaign_monthly_stats(_prefixes text[], _from date, _to date)
RETURNS TABLE(month date, sales bigint, revenue numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT date_trunc('month', c.signup_date)::date AS month,
         count(*)::bigint AS sales,
         COALESCE(sum(c.final_amount), 0)::numeric AS revenue
  FROM public.customers c
  WHERE public.is_staff()
    AND COALESCE(c.is_deleted, false) = false
    AND COALESCE(c.status, '') NOT ILIKE '%cancelled%'
    AND COALESCE(c.status, '') NOT ILIKE '%refunded%'
    AND c.signup_date >= _from
    AND c.signup_date < (_to + interval '1 day')
    AND c.postcode IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM unnest(_prefixes) p
      WHERE upper(regexp_replace(c.postcode, '\s', '', 'g')) LIKE upper(p) || '%'
    )
  GROUP BY 1
  ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.offline_campaign_monthly_stats(text[], date, date) TO authenticated;