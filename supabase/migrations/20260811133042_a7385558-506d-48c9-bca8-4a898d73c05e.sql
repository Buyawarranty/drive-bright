UPDATE public.blog_posts
SET canonical_url = 'https://buyawarranty.co.uk/thewarrantyhub/' || slug || '/'
WHERE canonical_url IS NULL AND published_at IS NOT NULL;