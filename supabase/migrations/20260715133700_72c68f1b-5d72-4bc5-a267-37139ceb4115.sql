UPDATE public.sales_leads
SET locked_by = NULL, locked_at = NULL, pool_status = 'new'
WHERE id = '05d9eb56-66d4-4fc2-b1bc-17b9d1160f47'
  AND locked_by = '0975f77e-a487-445d-8bf1-43955eb2de40'::uuid;