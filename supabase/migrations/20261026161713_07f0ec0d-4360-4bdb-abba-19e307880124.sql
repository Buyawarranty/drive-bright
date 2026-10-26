CREATE TABLE public.lead_view_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.sales_leads(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  first_viewed_at timestamptz NOT NULL DEFAULT now(),
  last_viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, viewer_id)
);

CREATE INDEX idx_lead_view_receipts_lead ON public.lead_view_receipts (lead_id);

GRANT SELECT ON public.lead_view_receipts TO authenticated;
GRANT ALL ON public.lead_view_receipts TO service_role;

ALTER TABLE public.lead_view_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Management can read lead view receipts"
ON public.lead_view_receipts
FOR SELECT
TO authenticated
USING (public.is_management(auth.uid()));

-- Writes go through this function only: it records a view for the caller's OWN
-- active staff account and refuses anything else, so nobody can forge receipts.
CREATE OR REPLACE FUNCTION public.mark_lead_seen(_lead_id uuid, _viewer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _viewer_id IS NULL OR _viewer_id <> public.current_admin_user_id() THEN
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE id = _viewer_id AND is_active = true) THEN
    RETURN;
  END IF;
  INSERT INTO public.lead_view_receipts (lead_id, viewer_id)
  VALUES (_lead_id, _viewer_id)
  ON CONFLICT (lead_id, viewer_id)
  DO UPDATE SET last_viewed_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_lead_seen(uuid, uuid) TO authenticated;