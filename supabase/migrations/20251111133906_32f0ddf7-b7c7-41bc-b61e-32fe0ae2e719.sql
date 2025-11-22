-- Create a helper function to check if user is a blog writer
CREATE OR REPLACE FUNCTION public.is_blog_writer(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_roles.user_id = is_blog_writer.user_id
    AND role = 'blog_writer'
  );
$$;