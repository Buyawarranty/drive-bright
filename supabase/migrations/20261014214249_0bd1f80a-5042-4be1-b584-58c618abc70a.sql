ALTER TABLE public.sale_authorisations
  ADD COLUMN IF NOT EXISTS agent_response text;

COMMENT ON COLUMN public.sale_authorisations.agent_response IS
  'What the selling agent said when closing the authorisation pop-up: accepted, will_speak_to_manager or acknowledged.';