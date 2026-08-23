ALTER TABLE public.ai_sandbox_threads ADD COLUMN IF NOT EXISTS sales_lead_id uuid;
CREATE INDEX IF NOT EXISTS idx_ai_sandbox_threads_sales_lead ON public.ai_sandbox_threads (sales_lead_id);
UPDATE public.feature_flags SET enabled = true WHERE key = 'ai_chat_creates_real_leads';
INSERT INTO public.feature_flags (key, enabled)
SELECT 'ai_chat_creates_real_leads', true
WHERE NOT EXISTS (SELECT 1 FROM public.feature_flags WHERE key = 'ai_chat_creates_real_leads');