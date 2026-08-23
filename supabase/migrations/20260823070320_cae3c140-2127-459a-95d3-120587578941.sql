INSERT INTO public.lead_tags (name, color)
SELECT 'Chatbot lead', '#0ea5e9'
WHERE NOT EXISTS (SELECT 1 FROM public.lead_tags WHERE name = 'Chatbot lead');