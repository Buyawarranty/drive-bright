ALTER TABLE public.claim_reminders REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.claim_reminders;