-- Drop and recreate lead_reminders with proper syntax
DROP TABLE IF EXISTS public.lead_reminders;

-- Personal Reminders for leads (time-bound, per agent)
CREATE TABLE public.lead_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  reminder_time TIMESTAMP WITH TIME ZONE NOT NULL,
  label TEXT CHECK (char_length(label) <= 120),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'snoozed', 'dismissed', 'completed')),
  snoozed_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_reminders ENABLE ROW LEVEL SECURITY;

-- Policies for reminders
CREATE POLICY "Users can view their own reminders"
  ON public.lead_reminders FOR SELECT
  USING (true);

CREATE POLICY "Users can create reminders"
  ON public.lead_reminders FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own reminders"
  ON public.lead_reminders FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete their own reminders"
  ON public.lead_reminders FOR DELETE
  USING (true);

-- Partial unique index: One active reminder per lead per agent
CREATE UNIQUE INDEX idx_lead_reminders_unique_active 
  ON public.lead_reminders (lead_id, user_id) 
  WHERE (status = 'pending' OR status = 'snoozed');

-- Other indexes for performance
CREATE INDEX idx_lead_reminders_lead_id ON public.lead_reminders(lead_id);
CREATE INDEX idx_lead_reminders_user_id ON public.lead_reminders(user_id);
CREATE INDEX idx_lead_reminders_reminder_time ON public.lead_reminders(reminder_time);
CREATE INDEX idx_lead_reminders_status ON public.lead_reminders(status);

-- Trigger for updated_at
CREATE TRIGGER update_lead_reminders_updated_at
  BEFORE UPDATE ON public.lead_reminders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();