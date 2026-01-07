-- Create enum for timesheet entry types
CREATE TYPE public.timesheet_entry_type AS ENUM ('worked', 'sick', 'holiday', 'unpaid_leave', 'training', 'wfh');

-- Create staff_timesheets table for daily entries
CREATE TABLE public.staff_timesheets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_user_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  entry_date DATE NOT NULL,
  entry_type timesheet_entry_type NOT NULL DEFAULT 'worked',
  hours_worked NUMERIC(4,2) DEFAULT 0,
  start_time TIME,
  end_time TIME,
  break_minutes INTEGER DEFAULT 0,
  notes TEXT,
  is_approved BOOLEAN DEFAULT FALSE,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, entry_date)
);

-- Create commission_records table
CREATE TABLE public.commission_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_user_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  deals_count INTEGER DEFAULT 0,
  total_sales_value NUMERIC(10,2) DEFAULT 0,
  commission_rate NUMERIC(5,4) DEFAULT 0.05,
  commission_amount NUMERIC(10,2) DEFAULT 0,
  bonus_amount NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create deal_records table for tracking individual sales
CREATE TABLE public.deal_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_user_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  deal_date DATE NOT NULL DEFAULT CURRENT_DATE,
  deal_value NUMERIC(10,2) NOT NULL,
  plan_type TEXT,
  customer_name TEXT,
  vehicle_reg TEXT,
  notes TEXT,
  commission_record_id UUID REFERENCES public.commission_records(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.staff_timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_records ENABLE ROW LEVEL SECURITY;

-- RLS policies for staff_timesheets
-- Users can view their own timesheets
CREATE POLICY "Users can view own timesheets"
ON public.staff_timesheets
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own timesheets
CREATE POLICY "Users can insert own timesheets"
ON public.staff_timesheets
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own unapproved timesheets
CREATE POLICY "Users can update own unapproved timesheets"
ON public.staff_timesheets
FOR UPDATE
USING (auth.uid() = user_id AND is_approved = FALSE);

-- Admins can view all timesheets
CREATE POLICY "Admins can view all timesheets"
ON public.staff_timesheets
FOR SELECT
USING (public.is_admin(auth.uid()));

-- Admins can update all timesheets (for approval)
CREATE POLICY "Admins can update all timesheets"
ON public.staff_timesheets
FOR UPDATE
USING (public.is_admin(auth.uid()));

-- RLS policies for commission_records
CREATE POLICY "Users can view own commission records"
ON public.commission_records
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all commission records"
ON public.commission_records
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert commission records"
ON public.commission_records
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update commission records"
ON public.commission_records
FOR UPDATE
USING (public.is_admin(auth.uid()));

-- RLS policies for deal_records
CREATE POLICY "Users can view own deal records"
ON public.deal_records
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own deal records"
ON public.deal_records
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all deal records"
ON public.deal_records
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage all deal records"
ON public.deal_records
FOR ALL
USING (public.is_admin(auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_staff_timesheets_user_date ON public.staff_timesheets(user_id, entry_date);
CREATE INDEX idx_staff_timesheets_date ON public.staff_timesheets(entry_date);
CREATE INDEX idx_commission_records_user_period ON public.commission_records(user_id, period_start, period_end);
CREATE INDEX idx_deal_records_user_date ON public.deal_records(user_id, deal_date);

-- Create triggers for updated_at
CREATE TRIGGER update_staff_timesheets_updated_at
BEFORE UPDATE ON public.staff_timesheets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_commission_records_updated_at
BEFORE UPDATE ON public.commission_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deal_records_updated_at
BEFORE UPDATE ON public.deal_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();