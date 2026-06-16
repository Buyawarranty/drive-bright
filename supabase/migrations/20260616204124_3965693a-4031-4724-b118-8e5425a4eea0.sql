
-- Export log header
CREATE TABLE public.abandoned_cart_exports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('google','facebook')),
  date_from TIMESTAMPTZ NOT NULL,
  date_to TIMESTAMPTZ NOT NULL,
  cart_count INTEGER NOT NULL DEFAULT 0,
  exported_by UUID,
  exported_by_email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.abandoned_cart_exports TO authenticated;
GRANT ALL ON public.abandoned_cart_exports TO service_role;
ALTER TABLE public.abandoned_cart_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view exports" ON public.abandoned_cart_exports
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users au WHERE au.id = auth.uid() AND au.is_active = true));

CREATE POLICY "Admins create exports" ON public.abandoned_cart_exports
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users au WHERE au.id = auth.uid() AND au.is_active = true));

-- Items in each export (for dedupe)
CREATE TABLE public.abandoned_cart_export_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  export_id UUID NOT NULL REFERENCES public.abandoned_cart_exports(id) ON DELETE CASCADE,
  abandoned_cart_id UUID NOT NULL,
  platform TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_acei_cart_platform ON public.abandoned_cart_export_items (abandoned_cart_id, platform);
CREATE INDEX idx_acei_export ON public.abandoned_cart_export_items (export_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.abandoned_cart_export_items TO authenticated;
GRANT ALL ON public.abandoned_cart_export_items TO service_role;
ALTER TABLE public.abandoned_cart_export_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view export items" ON public.abandoned_cart_export_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users au WHERE au.id = auth.uid() AND au.is_active = true));

CREATE POLICY "Admins create export items" ON public.abandoned_cart_export_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users au WHERE au.id = auth.uid() AND au.is_active = true));
