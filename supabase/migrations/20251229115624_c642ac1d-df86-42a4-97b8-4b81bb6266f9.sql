
-- Create lead_sources enum
DO $$ BEGIN
  CREATE TYPE lead_source AS ENUM ('website', 'referral', 'social_ad', 'google_ad', 'phone', 'email', 'partner', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create lead_status enum  
DO $$ BEGIN
  CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'follow_up', 'quote_sent', 'negotiating', 'converted', 'lost');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create lead_priority enum
DO $$ BEGIN
  CREATE TYPE lead_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create sales_leads table
CREATE TABLE IF NOT EXISTS public.sales_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Customer info
  first_name TEXT,
  last_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  -- Lead details
  lead_source lead_source DEFAULT 'website',
  status lead_status DEFAULT 'new',
  priority lead_priority DEFAULT 'medium',
  priority_score INTEGER DEFAULT 0,
  -- Product interest
  plan_interest TEXT,
  cart_value NUMERIC,
  quote_amount NUMERIC,
  -- Vehicle details (from abandoned cart)
  vehicle_reg TEXT,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_year TEXT,
  vehicle_type TEXT,
  mileage TEXT,
  -- Assignment
  assigned_to UUID REFERENCES public.admin_users(id),
  assigned_at TIMESTAMP WITH TIME ZONE,
  -- Follow-up tracking
  next_action_type TEXT, -- 'call', 'email', 'sms', 'meeting'
  next_action_date TIMESTAMP WITH TIME ZONE,
  follow_up_status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'overdue'
  last_activity_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_contacted_at TIMESTAMP WITH TIME ZONE,
  -- Notes
  notes TEXT,
  -- Conversion tracking
  converted_at TIMESTAMP WITH TIME ZONE,
  lost_at TIMESTAMP WITH TIME ZONE,
  lost_reason TEXT,
  -- Source reference (link to abandoned_carts if migrated)
  abandoned_cart_id UUID REFERENCES public.abandoned_carts(id),
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create lead_tags table
CREATE TABLE IF NOT EXISTS public.lead_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#6B7280',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create lead_tag_assignments junction table
CREATE TABLE IF NOT EXISTS public.lead_tag_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.sales_leads(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.lead_tags(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.admin_users(id),
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lead_id, tag_id)
);

-- Create lead_activities table for tracking all interactions
CREATE TABLE IF NOT EXISTS public.lead_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.sales_leads(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, -- 'call', 'email', 'sms', 'meeting', 'note', 'status_change'
  description TEXT,
  outcome TEXT,
  performed_by UUID REFERENCES public.admin_users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create salesperson_stats table for tracking performance
CREATE TABLE IF NOT EXISTS public.salesperson_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.admin_users(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  -- Activity metrics
  total_calls INTEGER DEFAULT 0,
  total_emails INTEGER DEFAULT 0,
  total_meetings INTEGER DEFAULT 0,
  -- Performance metrics
  leads_assigned INTEGER DEFAULT 0,
  leads_contacted INTEGER DEFAULT 0,
  leads_converted INTEGER DEFAULT 0,
  leads_lost INTEGER DEFAULT 0,
  total_revenue NUMERIC DEFAULT 0,
  -- Calculated metrics
  conversion_rate NUMERIC DEFAULT 0,
  avg_response_time_hours NUMERIC,
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, period_start, period_end)
);

-- Create sales_badges table for gamification
CREATE TABLE IF NOT EXISTS public.sales_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  criteria_type TEXT NOT NULL, -- 'deals_closed', 'revenue', 'conversion_rate', 'streak'
  criteria_value INTEGER NOT NULL,
  color TEXT DEFAULT '#F97316',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_badges junction table
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.admin_users(id),
  badge_id UUID NOT NULL REFERENCES public.sales_badges(id),
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

-- Create round_robin_state table for auto-assignment
CREATE TABLE IF NOT EXISTS public.round_robin_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  last_assigned_user_id UUID REFERENCES public.admin_users(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.sales_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salesperson_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_robin_state ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sales_leads
CREATE POLICY "Admins can manage all leads" ON public.sales_leads
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Sales users can view assigned leads" ON public.sales_leads
  FOR SELECT USING (
    assigned_to IN (SELECT id FROM admin_users WHERE user_id = auth.uid())
    OR is_admin(auth.uid())
  );

CREATE POLICY "Sales users can update assigned leads" ON public.sales_leads
  FOR UPDATE USING (
    assigned_to IN (SELECT id FROM admin_users WHERE user_id = auth.uid())
    OR is_admin(auth.uid())
  );

CREATE POLICY "Service role can manage leads" ON public.sales_leads
  FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for lead_tags
CREATE POLICY "Admins can manage lead tags" ON public.lead_tags
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "All users can view lead tags" ON public.lead_tags
  FOR SELECT USING (true);

-- RLS Policies for lead_tag_assignments
CREATE POLICY "Admins can manage tag assignments" ON public.lead_tag_assignments
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Service role can manage tag assignments" ON public.lead_tag_assignments
  FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for lead_activities
CREATE POLICY "Admins can manage all activities" ON public.lead_activities
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Sales users can view and create activities" ON public.lead_activities
  FOR ALL USING (is_admin(auth.uid()) OR performed_by IN (SELECT id FROM admin_users WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage activities" ON public.lead_activities
  FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for salesperson_stats
CREATE POLICY "Admins can manage all stats" ON public.salesperson_stats
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Users can view own stats" ON public.salesperson_stats
  FOR SELECT USING (user_id IN (SELECT id FROM admin_users WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage stats" ON public.salesperson_stats
  FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for sales_badges
CREATE POLICY "Anyone can view badges" ON public.sales_badges
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage badges" ON public.sales_badges
  FOR ALL USING (is_admin(auth.uid()));

-- RLS Policies for user_badges
CREATE POLICY "Anyone can view user badges" ON public.user_badges
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage user badges" ON public.user_badges
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Service role can manage user badges" ON public.user_badges
  FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for round_robin_state
CREATE POLICY "Admins can manage round robin state" ON public.round_robin_state
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Service role can manage round robin state" ON public.round_robin_state
  FOR ALL USING (true) WITH CHECK (true);

-- Create updated_at trigger for sales_leads
CREATE TRIGGER update_sales_leads_updated_at
  BEFORE UPDATE ON public.sales_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create updated_at trigger for salesperson_stats
CREATE TRIGGER update_salesperson_stats_updated_at
  BEFORE UPDATE ON public.salesperson_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to calculate lead priority score
CREATE OR REPLACE FUNCTION public.calculate_lead_priority_score(
  p_cart_value NUMERIC,
  p_last_activity_date TIMESTAMP WITH TIME ZONE,
  p_has_quote BOOLEAN DEFAULT false
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  score INTEGER := 0;
  days_inactive INTEGER;
BEGIN
  -- +10 for cart value > £500
  IF p_cart_value > 500 THEN
    score := score + 10;
  END IF;
  
  -- +5 for requested quote
  IF p_has_quote THEN
    score := score + 5;
  END IF;
  
  -- -5 for each 7 days of inactivity
  IF p_last_activity_date IS NOT NULL THEN
    days_inactive := EXTRACT(DAY FROM (now() - p_last_activity_date));
    score := score - (days_inactive / 7) * 5;
  END IF;
  
  -- Ensure score doesn't go below 0
  RETURN GREATEST(score, 0);
END;
$$;

-- Create function for round-robin assignment
CREATE OR REPLACE FUNCTION public.get_next_sales_user()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_user_id UUID;
  last_user_id UUID;
BEGIN
  -- Get last assigned user
  SELECT last_assigned_user_id INTO last_user_id FROM round_robin_state LIMIT 1;
  
  -- Get next active sales user in rotation
  SELECT au.id INTO next_user_id
  FROM admin_users au
  INNER JOIN user_roles ur ON ur.user_id = au.user_id
  WHERE au.is_active = true
    AND ur.role IN ('admin', 'member', 'sales')
    AND (last_user_id IS NULL OR au.id > last_user_id)
  ORDER BY au.id
  LIMIT 1;
  
  -- If no user found (we've reached the end), start from beginning
  IF next_user_id IS NULL THEN
    SELECT au.id INTO next_user_id
    FROM admin_users au
    INNER JOIN user_roles ur ON ur.user_id = au.user_id
    WHERE au.is_active = true
      AND ur.role IN ('admin', 'member', 'sales')
    ORDER BY au.id
    LIMIT 1;
  END IF;
  
  -- Update round robin state
  IF next_user_id IS NOT NULL THEN
    INSERT INTO round_robin_state (last_assigned_user_id, updated_at)
    VALUES (next_user_id, now())
    ON CONFLICT (id) DO UPDATE SET 
      last_assigned_user_id = next_user_id,
      updated_at = now();
  END IF;
  
  RETURN next_user_id;
END;
$$;

-- Insert default lead tags
INSERT INTO public.lead_tags (name, color, description) VALUES
  ('Hot Lead', '#EF4444', 'High intent buyer ready to purchase'),
  ('Abandoned Cart', '#F97316', 'Left items in cart without purchasing'),
  ('Price Sensitive', '#EAB308', 'Looking for best price/deal'),
  ('Repeat Customer', '#22C55E', 'Has purchased before'),
  ('Urgent', '#DC2626', 'Needs immediate attention'),
  ('VIP', '#8B5CF6', 'High value customer'),
  ('Callback Requested', '#3B82F6', 'Customer requested callback')
ON CONFLICT (name) DO NOTHING;

-- Insert default sales badges
INSERT INTO public.sales_badges (name, description, icon, criteria_type, criteria_value, color) VALUES
  ('First Sale', 'Closed your first deal!', '🎯', 'deals_closed', 1, '#22C55E'),
  ('10 Deals Club', 'Closed 10 deals', '🏆', 'deals_closed', 10, '#F97316'),
  ('25 Deals Master', 'Closed 25 deals', '⭐', 'deals_closed', 25, '#8B5CF6'),
  ('50 Deals Legend', 'Closed 50 deals', '👑', 'deals_closed', 50, '#EAB308'),
  ('£10K Revenue', 'Generated £10,000 in revenue', '💰', 'revenue', 10000, '#22C55E'),
  ('£50K Revenue', 'Generated £50,000 in revenue', '💎', 'revenue', 50000, '#3B82F6'),
  ('Conversion King', 'Achieved 50% conversion rate', '📈', 'conversion_rate', 50, '#EC4899')
ON CONFLICT DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sales_leads_status ON public.sales_leads(status);
CREATE INDEX IF NOT EXISTS idx_sales_leads_assigned_to ON public.sales_leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_sales_leads_priority ON public.sales_leads(priority);
CREATE INDEX IF NOT EXISTS idx_sales_leads_next_action_date ON public.sales_leads(next_action_date);
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON public.lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_tag_assignments_lead_id ON public.lead_tag_assignments(lead_id);
