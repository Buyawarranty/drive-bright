UPDATE public.sales_leads
   SET last_resubmitted_at = now(),
       updated_at = now()
 WHERE assigned_to = '019299c4-4bb3-4cfc-b205-0d6cd4f64dd5'
   AND assigned_at > now() - interval '2 hours'
   AND last_resubmitted_at IS DISTINCT FROM date_trunc('second', now());