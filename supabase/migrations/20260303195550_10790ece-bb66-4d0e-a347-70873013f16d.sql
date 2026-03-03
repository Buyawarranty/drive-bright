-- Create timesheet_comments table for messaging between agents and accounts
CREATE TABLE public.timesheet_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES public.admin_users(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  month_year TEXT NOT NULL, -- e.g. '2026-03'
  message TEXT NOT NULL,
  is_from_accounts BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_timesheet_comments_agent_month ON timesheet_comments(admin_user_id, month_year);

-- RLS
ALTER TABLE public.timesheet_comments ENABLE ROW LEVEL SECURITY;

-- Accounts/admin can read all, agents can read their own
CREATE POLICY "Users can view relevant comments"
ON public.timesheet_comments FOR SELECT
TO authenticated
USING (
  admin_user_id IN (SELECT id FROM admin_users WHERE user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = auth.uid() 
    AND role::text IN ('admin', 'super_admin', 'accounts_manager', 'accounts_payroll')
    AND is_active = true
  )
);

-- Anyone authenticated can insert (agents post their own, accounts reply)
CREATE POLICY "Authenticated users can insert comments"
ON public.timesheet_comments FOR INSERT
TO authenticated
WITH CHECK (
  author_id IN (SELECT id FROM admin_users WHERE user_id = auth.uid())
);

-- Trigger for updated_at
CREATE TRIGGER update_timesheet_comments_updated_at
  BEFORE UPDATE ON public.timesheet_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();