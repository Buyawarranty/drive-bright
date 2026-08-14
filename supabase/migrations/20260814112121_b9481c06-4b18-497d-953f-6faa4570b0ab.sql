UPDATE public.admin_users
SET permissions = COALESCE(permissions, '{}'::jsonb) || jsonb_build_object('tab_get-quote', 'true')
WHERE is_active = true
  AND COALESCE(permissions->>'tab_get-quote', 'false') <> 'true';