-- Freddie Howard is set to Open Round Robin but was left paused, so his ORR bar
-- rendered nothing and he had no indication he was on ORR. Unpause him so
-- distribution and the bar activate immediately.
UPDATE public.agent_distribution_caps
SET paused = false,
    updated_at = now()
WHERE admin_user_id = 'd48ba5c6-999d-4ae1-b9bf-1a16120cd202'
  AND assignment_mode = 'open_pool'
  AND paused = true;