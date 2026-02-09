-- Allow sales_lead to view ALL sales leads (not just assigned ones)
CREATE POLICY "Sales leads can view all leads"
ON public.sales_leads
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
    AND role = 'sales_lead'
    AND is_active = true
  )
);

-- Allow sales_lead to update ALL sales leads (for assignment)
CREATE POLICY "Sales leads can update all leads"
ON public.sales_leads
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
    AND role = 'sales_lead'
    AND is_active = true
  )
);

-- Allow sales_lead to view ALL abandoned carts
CREATE POLICY "Sales leads can view all abandoned carts"
ON public.abandoned_carts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
    AND role = 'sales_lead'
    AND is_active = true
  )
);

-- Allow sales_lead to update ALL abandoned carts
CREATE POLICY "Sales leads can update all abandoned carts"
ON public.abandoned_carts
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
    AND role = 'sales_lead'
    AND is_active = true
  )
);