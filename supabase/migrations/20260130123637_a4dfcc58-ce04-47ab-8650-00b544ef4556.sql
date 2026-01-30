-- Unpause agents so they can claim leads
-- The support and info accounts were paused, preventing them from claiming leads

UPDATE public.agent_distribution_caps
SET paused = false, updated_at = now()
WHERE admin_user_id IN (
  SELECT id FROM public.admin_users WHERE email IN ('support@buyawarranty.co.uk', 'info@buyawarranty.co.uk')
);