-- Rename blog-writing admin tab permission to blogs-data
-- so existing users keep access after the URL/tab id change.

update public.admin_users
set permissions = permissions -
  'tab_blog-writing' ||
  jsonb_build_object(
    'tab_blogs-data',
    coalesce(permissions->>'tab_blog-writing', 'true')::jsonb
  )
where permissions ? 'tab_blog-writing';
