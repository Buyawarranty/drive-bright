
WITH moved AS (
  UPDATE public.sales_leads
  SET assigned_to = 'd48ba5c6-999d-4ae1-b9bf-1a16120cd202',
      assigned_at = now()
  WHERE assigned_to = '0975f77e-a487-445d-8bf1-43955eb2de40'
  RETURNING id
)
INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
SELECT id, 'd48ba5c6-999d-4ae1-b9bf-1a16120cd202', '0975f77e-a487-445d-8bf1-43955eb2de40',
       'manager_bulk_reassign',
       'Bulk reassign from info@buyawarranty.co.uk to Freddie Howard'
FROM moved;
