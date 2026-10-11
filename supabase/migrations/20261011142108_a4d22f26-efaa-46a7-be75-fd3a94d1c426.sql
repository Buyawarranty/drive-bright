CREATE TABLE public.price_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_at timestamptz NOT NULL,
  label text NOT NULL,
  details text,
  source text NOT NULL DEFAULT 'manual',
  pricing_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_change_log TO authenticated;
GRANT ALL ON public.price_change_log TO service_role;
ALTER TABLE public.price_change_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage price change log" ON public.price_change_log FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active AND role::text IN ('admin','super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active AND role::text IN ('admin','super_admin')));

INSERT INTO public.price_change_log (changed_at, label, details, source) VALUES
 ('2026-07-28 11:20:00+00', '2 & 3-year +20%', '2 and 3-year prices and minimums raised 20%. 1-year unchanged.', 'code'),
 ('2026-09-10 07:47:00+00', '2 & 3-year +10%', '2 and 3-year prices raised another 10%; minimums now £769 / £1,099. 1-year unchanged.', 'code');

INSERT INTO public.price_change_log (changed_at, label, details, source, pricing_version_id)
SELECT published_at, 'Price list pushed live: ' || coalesce(label,'(no name)'), 'Pushed from Price Updates', 'price_updates', id
FROM public.pricing_matrix_versions WHERE published_at IS NOT NULL;

-- Automatically log every future price push.
CREATE OR REPLACE FUNCTION public.log_pricing_version_publish()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.published_at IS NOT NULL AND (OLD.published_at IS DISTINCT FROM NEW.published_at) THEN
    INSERT INTO public.price_change_log (changed_at, label, details, source, pricing_version_id)
    VALUES (NEW.published_at, 'Price list pushed live: ' || coalesce(NEW.label,'(no name)'), 'Pushed from Price Updates', 'price_updates', NEW.id);
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.log_pricing_version_publish() FROM public, anon, authenticated;
CREATE TRIGGER trg_log_pricing_version_publish AFTER INSERT OR UPDATE OF published_at ON public.pricing_matrix_versions
  FOR EACH ROW EXECUTE FUNCTION public.log_pricing_version_publish();

-- Performance of direct website sales between each price change (same-day pushes grouped).
CREATE OR REPLACE FUNCTION public.get_price_change_performance(_from date DEFAULT '2026-03-01')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active AND role::text IN ('admin','super_admin')) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  WITH changes AS (
    SELECT date_trunc('day', changed_at) d, min(changed_at) at,
      string_agg(DISTINCT label, ' | ') labels, count(*) pushes
    FROM public.price_change_log WHERE changed_at >= _from GROUP BY 1
    UNION ALL SELECT _from::timestamptz, _from::timestamptz, 'Starting prices (from 1 March)', 0
  ),
  w AS (
    SELECT at s, coalesce(lead(at) OVER (ORDER BY at), now()) e, labels, pushes FROM changes
  ),
  m AS (
    SELECT w.*,
      (SELECT count(*) FROM abandoned_carts c WHERE c.created_at >= w.s AND c.created_at < w.e AND c.step_abandoned >= 3) step3,
      (SELECT count(*) FROM abandoned_carts c WHERE c.created_at >= w.s AND c.created_at < w.e AND c.step_abandoned = 4) step4,
      (SELECT count(*) FROM customers k WHERE k.signup_date >= w.s AND k.signup_date < w.e
         AND coalesce(k.status,'') NOT IN ('cancelled','refunded') AND coalesce(k.is_deleted,false)=false
         AND k.is_manual_entry IS NOT TRUE AND k.payment_confirmed_by IS NULL AND coalesce(k.final_amount,0) > 10) sales,
      (SELECT coalesce(sum(final_amount),0) FROM customers k WHERE k.signup_date >= w.s AND k.signup_date < w.e
         AND coalesce(k.status,'') NOT IN ('cancelled','refunded') AND coalesce(k.is_deleted,false)=false
         AND k.is_manual_entry IS NOT TRUE AND k.payment_confirmed_by IS NULL AND coalesce(k.final_amount,0) > 10) revenue
    FROM w
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'start', s, 'end', e, 'label', labels, 'pushes', pushes,
    'days', round(extract(epoch FROM (e - s)) / 86400.0, 1),
    'step3', step3, 'step4', step4, 'sales', sales, 'revenue', round(revenue)
  ) ORDER BY s), '[]'::jsonb) INTO r FROM m;
  RETURN r;
END; $$;
REVOKE ALL ON FUNCTION public.get_price_change_performance(date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_price_change_performance(date) TO authenticated;