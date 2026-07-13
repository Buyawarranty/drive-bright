INSERT INTO public.lead_settings (setting_key, setting_value)
VALUES ('weekend_saturday_roster', '[]'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;
