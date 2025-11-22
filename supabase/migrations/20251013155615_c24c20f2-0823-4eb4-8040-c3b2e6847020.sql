
-- Delete all blog post tags (junction table)
DELETE FROM public.blog_post_tags;

-- Delete all blog comments
DELETE FROM public.blog_comments;

-- Delete all blog posts
DELETE FROM public.blog_posts;

-- Delete all blog tags (optional - only if they were auto-generated)
DELETE FROM public.blog_tags;
