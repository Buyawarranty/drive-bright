INSERT INTO public.feature_flags (key, label, description, enabled, category)
VALUES (
  'renewals_engine_live',
  'Renewals engine live',
  'When ON, renewal leads from the new renewals engine flow into New Leads. When OFF, the engine stays in sandbox and nothing is pushed to New Leads.',
  false,
  'Leads'
)
ON CONFLICT (key) DO NOTHING;