INSERT INTO public.lead_tags (name, color, description, is_active)
VALUES ('VERIFY vehicle', '#F59E0B', 'Vehicle needs manual verification (e.g. NI plate not on DVLA)', true)
ON CONFLICT DO NOTHING;