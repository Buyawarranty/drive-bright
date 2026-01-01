-- Create enum for masking levels
CREATE TYPE public.mask_level AS ENUM ('none', 'partial', 'full');

-- Create enum for permission action scope
CREATE TYPE public.action_scope AS ENUM ('none', 'own', 'team', 'department', 'global');

-- Create table for permission policies (granular JSON policies for users)
CREATE TABLE public.permission_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  department text, -- sales, accounts, support, marketing, or null for global
  is_template boolean DEFAULT false, -- true for role templates like sales_manager
  
  -- Security settings
  require_2fa boolean DEFAULT true,
  require_sso boolean DEFAULT false,
  session_timeout_minutes integer DEFAULT 30,
  export_rate_limit_per_hour integer DEFAULT 2,
  approval_required_for_export boolean DEFAULT true,
  
  -- Tab permissions stored as JSONB with structure:
  -- { "tab_name": { "view": bool, "create": bool, "edit": bool, "delete": bool, "export": bool, "approve": bool } }
  tabs_permissions jsonb DEFAULT '{}'::jsonb NOT NULL,
  
  -- Column masking stored as JSONB with structure:
  -- { "table.column": { "view": bool, "mask": "none|partial|full" } }
  column_masking jsonb DEFAULT '{}'::jsonb NOT NULL,
  
  -- Action permissions stored as JSONB
  action_permissions jsonb DEFAULT '{}'::jsonb NOT NULL,
  
  -- Scope and temporary elevation
  scope_team text,
  scope_region text,
  elevated_until timestamp with time zone,
  
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid
);

-- Enable RLS
ALTER TABLE public.permission_policies ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage permission policies"
ON public.permission_policies
FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Service role can manage permission policies"
ON public.permission_policies
FOR ALL
USING (true)
WITH CHECK (true);

-- Add policy_id column to admin_users to link to a permission policy
ALTER TABLE public.admin_users 
ADD COLUMN IF NOT EXISTS policy_id uuid REFERENCES public.permission_policies(id),
ADD COLUMN IF NOT EXISTS department text,
ADD COLUMN IF NOT EXISTS require_2fa boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS column_masking jsonb DEFAULT '{}'::jsonb;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_permission_policies_is_template ON public.permission_policies(is_template);
CREATE INDEX IF NOT EXISTS idx_permission_policies_department ON public.permission_policies(department);
CREATE INDEX IF NOT EXISTS idx_admin_users_policy_id ON public.admin_users(policy_id);

-- Insert default role templates
INSERT INTO public.permission_policies (name, description, department, is_template, tabs_permissions, column_masking, action_permissions) VALUES
-- Super Admin template
('super_admin', 'Full control including security and SSO settings', null, true,
 '{"analytics": {"view": true, "create": true, "edit": true, "delete": true, "export": true, "approve": true}, "user_permissions": {"view": true, "create": true, "edit": true, "delete": true, "export": true, "approve": true}, "document_mapping": {"view": true, "create": true, "edit": true, "delete": true, "export": true, "approve": true}, "blog_writing": {"view": true, "create": true, "edit": true, "delete": true, "export": true, "approve": true}, "customers": {"view": true, "create": true, "edit": true, "delete": true, "export": true, "approve": true}, "orders": {"view": true, "create": true, "edit": true, "delete": true, "export": true, "approve": true}, "warranties": {"view": true, "create": true, "edit": true, "delete": true, "export": true, "approve": true}, "claims": {"view": true, "create": true, "edit": true, "delete": true, "export": true, "approve": true}, "payments": {"view": true, "create": true, "edit": true, "delete": true, "export": true, "approve": true}, "marketing": {"view": true, "create": true, "edit": true, "delete": true, "export": true, "approve": true}, "settings": {"view": true, "create": true, "edit": true, "delete": true, "export": true, "approve": true}}'::jsonb,
 '{"customers.email": {"view": true, "mask": "none"}, "customers.phone": {"view": true, "mask": "none"}, "customers.address": {"view": true, "mask": "none"}, "orders.customer_email": {"view": true, "mask": "none"}, "orders.commission": {"view": true, "mask": "none"}, "orders.net_price": {"view": true, "mask": "none"}}'::jsonb,
 '{"approve_discount": {"allowed": true, "limit_percent": 100}, "invite_user": {"allowed": true, "scope": "global"}, "manage_roles": {"allowed": true, "scope": "global"}, "resend_invite": {"allowed": true}, "deactivate_user": {"allowed": true}, "reactivate_user": {"allowed": true}}'::jsonb
),

-- Sales Manager template
('sales_manager', 'Manage sales team, customers, orders, approve discounts up to 10%', 'sales', true,
 '{"analytics": {"view": "team", "create": false, "edit": false, "delete": false, "export": true, "approve": false}, "user_permissions": {"view": true, "create": false, "edit": true, "delete": false, "export": false, "approve": false}, "customers": {"view": true, "create": true, "edit": true, "delete": false, "export": true, "approve": false}, "orders": {"view": true, "create": true, "edit": true, "delete": false, "export": true, "approve": true}, "warranties": {"view": true, "create": true, "edit": true, "delete": false, "export": false, "approve": false}, "claims": {"view": true, "create": false, "edit": false, "delete": false, "export": false, "approve": false}, "marketing": {"view": true, "create": false, "edit": false, "delete": false, "export": false, "approve": false}}'::jsonb,
 '{"customers.email": {"view": true, "mask": "none"}, "customers.phone": {"view": true, "mask": "partial"}, "customers.address": {"view": true, "mask": "partial"}, "orders.customer_email": {"view": true, "mask": "none"}, "orders.commission": {"view": true, "mask": "none"}, "orders.net_price": {"view": true, "mask": "none"}}'::jsonb,
 '{"approve_discount": {"allowed": true, "limit_percent": 10}, "invite_user": {"allowed": true, "scope": "department"}, "manage_roles": {"allowed": true, "scope": "department"}, "resend_invite": {"allowed": true}, "deactivate_user": {"allowed": true}, "reactivate_user": {"allowed": true}}'::jsonb
),

-- Sales Agent template
('sales_agent', 'Handle customer orders and warranties, limited export', 'sales', true,
 '{"analytics": {"view": "team", "create": false, "edit": false, "delete": false, "export": false, "approve": false}, "customers": {"view": true, "create": true, "edit": true, "delete": false, "export": false, "approve": false}, "orders": {"view": true, "create": true, "edit": "own", "delete": false, "export": false, "approve": false}, "warranties": {"view": true, "create": true, "edit": true, "delete": false, "export": false, "approve": false}}'::jsonb,
 '{"customers.email": {"view": true, "mask": "partial"}, "customers.phone": {"view": true, "mask": "partial"}, "customers.address": {"view": false, "mask": "full"}, "orders.customer_email": {"view": true, "mask": "partial"}, "orders.commission": {"view": false, "mask": "full"}, "orders.net_price": {"view": false, "mask": "full"}}'::jsonb,
 '{"approve_discount": {"allowed": false, "limit_percent": 0}, "invite_user": {"allowed": false, "scope": "none"}, "manage_roles": {"allowed": false, "scope": "none"}, "resend_invite": {"allowed": false}, "deactivate_user": {"allowed": false}, "reactivate_user": {"allowed": false}}'::jsonb
),

-- Accounts Admin template
('accounts_admin', 'Manage payments, refunds, financial reporting', 'accounts', true,
 '{"analytics": {"view": true, "create": false, "edit": false, "delete": false, "export": true, "approve": false}, "orders": {"view": true, "create": false, "edit": false, "delete": false, "export": false, "approve": false}, "payments": {"view": true, "create": true, "edit": true, "delete": false, "export": true, "approve": true}, "claims": {"view": true, "create": false, "edit": true, "delete": false, "export": false, "approve": true}}'::jsonb,
 '{"customers.email": {"view": true, "mask": "none"}, "customers.phone": {"view": true, "mask": "partial"}, "customers.address": {"view": true, "mask": "none"}, "orders.customer_email": {"view": true, "mask": "none"}, "orders.commission": {"view": true, "mask": "none"}, "orders.net_price": {"view": true, "mask": "none"}}'::jsonb,
 '{"approve_discount": {"allowed": false, "limit_percent": 0}, "invite_user": {"allowed": true, "scope": "department"}, "manage_roles": {"allowed": false, "scope": "none"}, "resend_invite": {"allowed": false}, "deactivate_user": {"allowed": false}, "reactivate_user": {"allowed": false}}'::jsonb
),

-- Support Agent template
('support_agent', 'Handle claims and customer inquiries', 'support', true,
 '{"customers": {"view": true, "create": false, "edit": false, "delete": false, "export": false, "approve": false}, "orders": {"view": true, "create": false, "edit": false, "delete": false, "export": false, "approve": false}, "claims": {"view": true, "create": true, "edit": true, "delete": false, "export": false, "approve": false}, "document_mapping": {"view": true, "create": false, "edit": false, "delete": false, "export": false, "approve": false}}'::jsonb,
 '{"customers.email": {"view": true, "mask": "partial"}, "customers.phone": {"view": true, "mask": "partial"}, "customers.address": {"view": false, "mask": "full"}, "orders.customer_email": {"view": true, "mask": "partial"}, "orders.commission": {"view": false, "mask": "full"}, "orders.net_price": {"view": false, "mask": "full"}}'::jsonb,
 '{"approve_discount": {"allowed": false, "limit_percent": 0}, "invite_user": {"allowed": false, "scope": "none"}, "manage_roles": {"allowed": false, "scope": "none"}, "resend_invite": {"allowed": false}, "deactivate_user": {"allowed": false}, "reactivate_user": {"allowed": false}}'::jsonb
),

-- Auditor template
('auditor', 'Read-only access for audit purposes, optional export', null, true,
 '{"analytics": {"view": true, "create": false, "edit": false, "delete": false, "export": true, "approve": false}, "customers": {"view": true, "create": false, "edit": false, "delete": false, "export": false, "approve": false}, "orders": {"view": true, "create": false, "edit": false, "delete": false, "export": false, "approve": false}, "payments": {"view": true, "create": false, "edit": false, "delete": false, "export": false, "approve": false}, "claims": {"view": true, "create": false, "edit": false, "delete": false, "export": false, "approve": false}}'::jsonb,
 '{"customers.email": {"view": true, "mask": "partial"}, "customers.phone": {"view": false, "mask": "full"}, "customers.address": {"view": false, "mask": "full"}, "orders.customer_email": {"view": true, "mask": "partial"}, "orders.commission": {"view": false, "mask": "full"}, "orders.net_price": {"view": false, "mask": "full"}}'::jsonb,
 '{"approve_discount": {"allowed": false, "limit_percent": 0}, "invite_user": {"allowed": false, "scope": "none"}, "manage_roles": {"allowed": false, "scope": "none"}, "resend_invite": {"allowed": false}, "deactivate_user": {"allowed": false}, "reactivate_user": {"allowed": false}}'::jsonb
),

-- AI Content Editor template
('ai_content_editor', 'Blog writing and content management only', 'marketing', true,
 '{"blog_writing": {"view": true, "create": true, "edit": true, "delete": true, "export": false, "approve": false}, "landing_pages": {"view": true, "create": true, "edit": true, "delete": false, "export": false, "approve": false}}'::jsonb,
 '{}'::jsonb,
 '{"approve_discount": {"allowed": false, "limit_percent": 0}, "invite_user": {"allowed": false, "scope": "none"}, "manage_roles": {"allowed": false, "scope": "none"}, "resend_invite": {"allowed": false}, "deactivate_user": {"allowed": false}, "reactivate_user": {"allowed": false}}'::jsonb
);

-- Create trigger for updated_at
CREATE TRIGGER update_permission_policies_updated_at
BEFORE UPDATE ON public.permission_policies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to get user's effective permissions (merging role template + custom overrides)
CREATE OR REPLACE FUNCTION public.get_user_permissions(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_record RECORD;
  policy_record RECORD;
  result jsonb;
BEGIN
  -- Get admin user record
  SELECT * INTO user_record FROM admin_users WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN '{}'::jsonb;
  END IF;
  
  -- Get linked policy if exists
  IF user_record.policy_id IS NOT NULL THEN
    SELECT * INTO policy_record FROM permission_policies WHERE id = user_record.policy_id;
    result := jsonb_build_object(
      'tabs', policy_record.tabs_permissions,
      'columns', policy_record.column_masking,
      'actions', policy_record.action_permissions,
      'security', jsonb_build_object(
        'require_2fa', policy_record.require_2fa,
        'require_sso', policy_record.require_sso,
        'session_timeout_minutes', policy_record.session_timeout_minutes,
        'export_rate_limit_per_hour', policy_record.export_rate_limit_per_hour,
        'approval_required_for_export', policy_record.approval_required_for_export
      ),
      'department', policy_record.department,
      'elevated_until', policy_record.elevated_until
    );
  ELSE
    -- Fallback to legacy permissions column
    result := jsonb_build_object(
      'tabs', COALESCE(user_record.permissions, '{}'::jsonb),
      'columns', COALESCE(user_record.column_masking, '{}'::jsonb),
      'actions', '{}'::jsonb,
      'security', jsonb_build_object(
        'require_2fa', COALESCE(user_record.require_2fa, true)
      ),
      'department', user_record.department
    );
  END IF;
  
  RETURN result;
END;
$$;

-- Create function to check tab permission
CREATE OR REPLACE FUNCTION public.has_tab_permission(p_user_id uuid, p_tab text, p_action text DEFAULT 'view')
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  perms jsonb;
  tab_perms jsonb;
BEGIN
  perms := get_user_permissions(p_user_id);
  tab_perms := perms->'tabs'->p_tab;
  
  IF tab_perms IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN COALESCE((tab_perms->>p_action)::boolean, false);
END;
$$;

-- Create function to get column mask level
CREATE OR REPLACE FUNCTION public.get_column_mask(p_user_id uuid, p_column text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  perms jsonb;
  col_perm jsonb;
BEGIN
  perms := get_user_permissions(p_user_id);
  col_perm := perms->'columns'->p_column;
  
  IF col_perm IS NULL OR NOT COALESCE((col_perm->>'view')::boolean, false) THEN
    RETURN 'full'; -- Full mask if no permission
  END IF;
  
  RETURN COALESCE(col_perm->>'mask', 'full');
END;
$$;