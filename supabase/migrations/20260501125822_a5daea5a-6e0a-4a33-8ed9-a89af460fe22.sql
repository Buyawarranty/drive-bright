UPDATE public.admin_users
SET permissions = permissions - 'tab_new-leads_all-leads'
WHERE id = '98dc0e81-9f83-45b9-8c98-e7875b314dec';