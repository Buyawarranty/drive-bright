-- Keep Joseph in the main round-robin allocation with a clear position before Thomas
UPDATE public.agent_distribution_caps
SET
  daily_cap = 6,
  paused = false,
  sort_order = 3,
  updated_at = now()
WHERE admin_user_id = '9035beaf-f510-442c-82eb-05fc484cc9c6'::uuid;

-- Remove the tie that made Joseph and Thomas indistinguishable in the round-robin order
UPDATE public.agent_distribution_caps
SET
  sort_order = 4,
  updated_at = now()
WHERE admin_user_id = '98dc0e81-9f83-45b9-8c98-e7875b314dec'::uuid;

-- Ensure the next eligible lead goes to Joseph, then the rotation continues normally
UPDATE public.round_robin_state
SET
  last_assigned_user_id = '7083d831-4634-47a4-b3e2-61ac9908bf85'::uuid,
  updated_at = now();

INSERT INTO public.round_robin_state (last_assigned_user_id, updated_at)
SELECT '7083d831-4634-47a4-b3e2-61ac9908bf85'::uuid, now()
WHERE NOT EXISTS (SELECT 1 FROM public.round_robin_state);