update public.blog_posts
set
  featured_image_url = replace(featured_image_url, '/blog/', 'https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/blog-images/'),
  content = jsonb_set(
    content,
    '{html}',
    to_jsonb(replace(content->>'html', 'src="/blog/', 'src="https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/blog-images/'))
  ),
  structured_data = replace(
    structured_data::text,
    'https://buyawarranty.co.uk/blog/',
    'https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/blog-images/'
  )::jsonb,
  updated_at = now()
where slug in (
  'tesla-warranty-uk-2026-battery-cover-repair-costs-extended-options',
  'petrol-diesel-vehicle-warranty-cover-complete-uk-drivers-guide'
);