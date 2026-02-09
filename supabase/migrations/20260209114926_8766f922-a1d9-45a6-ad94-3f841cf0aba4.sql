
-- Create agent_daily_targets table
CREATE TABLE public.agent_daily_targets (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
    set_by UUID NOT NULL REFERENCES public.admin_users(id),
    target_date DATE NOT NULL,
    target_leads INTEGER NOT NULL DEFAULT 0,
    target_sales INTEGER NOT NULL DEFAULT 0,
    actual_leads INTEGER NOT NULL DEFAULT 0,
    actual_sales INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(agent_id, target_date)
);

ALTER TABLE public.agent_daily_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and sales leads can view all targets"
ON public.agent_daily_targets FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.admin_users
        WHERE user_id = auth.uid() AND role IN ('admin', 'sales_lead') AND is_active = true
    )
);

CREATE POLICY "Agents can view own targets"
ON public.agent_daily_targets FOR SELECT TO authenticated
USING (
    agent_id IN (SELECT id FROM public.admin_users WHERE user_id = auth.uid())
);

CREATE POLICY "Admins and sales leads can insert targets"
ON public.agent_daily_targets FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.admin_users
        WHERE user_id = auth.uid() AND role IN ('admin', 'sales_lead') AND is_active = true
    )
);

CREATE POLICY "Admins and sales leads can update targets"
ON public.agent_daily_targets FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.admin_users
        WHERE user_id = auth.uid() AND role IN ('admin', 'sales_lead') AND is_active = true
    )
);

CREATE POLICY "Admins can delete targets"
ON public.agent_daily_targets FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.admin_users
        WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
    )
);

CREATE TRIGGER update_agent_daily_targets_updated_at
BEFORE UPDATE ON public.agent_daily_targets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Update is_admin_or_sales to include sales_lead
CREATE OR REPLACE FUNCTION public.is_admin_or_sales(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = _user_id 
    AND role IN ('admin', 'sales', 'sales_lead')
    AND is_active = true
  );
$$;
