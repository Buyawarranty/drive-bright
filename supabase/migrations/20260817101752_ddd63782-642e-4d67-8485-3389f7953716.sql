UPDATE blog_posts
SET content = jsonb_set(content, '{html}', to_jsonb(replace(content->>'html', '\n', E'\n')))
WHERE (content->>'html') LIKE '%Related reading:%' AND (content->>'html') LIKE '%\n%';