
ALTER TABLE public.sales_leads DISABLE TRIGGER trg_protect_worked_lead_assignment;

WITH moved AS (
  UPDATE public.sales_leads
     SET assigned_to = 'd48ba5c6-999d-4ae1-b9bf-1a16120cd202',
         updated_at = now()
   WHERE assigned_to = '0975f77e-a487-445d-8bf1-43955eb2de40'
  RETURNING id
)
INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
SELECT id, 'd48ba5c6-999d-4ae1-b9bf-1a16120cd202', NULL, 'bulk_reassign',
       'Bulk reassigned from info@buyawarranty.co.uk to Freddie Howard (manager cleanup)'
  FROM moved;

ALTER TABLE public.sales_leads ENABLE TRIGGER trg_protect_worked_lead_assignment;
