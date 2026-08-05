ALTER TABLE public.sales_targets REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_targets;