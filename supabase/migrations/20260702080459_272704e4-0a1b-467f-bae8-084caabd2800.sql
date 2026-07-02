-- Hide blog author staff emails from anonymous visitors while keeping the rest
-- of the blog_authors row publicly readable (name, bio, avatar, etc).
REVOKE SELECT (email) ON public.blog_authors FROM anon;
-- Authenticated staff (admins editing blog posts) still need to see the email.
GRANT SELECT (email) ON public.blog_authors TO authenticated;