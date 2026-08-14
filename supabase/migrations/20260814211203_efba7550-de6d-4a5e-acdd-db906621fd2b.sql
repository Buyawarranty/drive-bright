INSERT INTO public.feature_flags (key, label, description, category, enabled)
VALUES (
  'ai_chat_creates_real_leads',
  'AI chat creates real leads',
  'When enabled, leads captured by the AI assistant are also written into the New Leads pipeline (with dedupe and round-robin assignment). Keep off while the assistant is sandbox only.',
  'admin',
  false
)
ON CONFLICT (key) DO NOTHING;