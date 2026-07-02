
DROP POLICY IF EXISTS "Admin users can insert sent quotes" ON public.admin_sent_quotes;
DROP POLICY IF EXISTS "Admin users can update sent quotes" ON public.admin_sent_quotes;
DROP POLICY IF EXISTS "Admin users can view sent quotes" ON public.admin_sent_quotes;

CREATE POLICY "Admin staff can insert sent quotes"
ON public.admin_sent_quotes FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Admin staff can update sent quotes"
ON public.admin_sent_quotes FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Admin staff can view sent quotes"
ON public.admin_sent_quotes FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true));
