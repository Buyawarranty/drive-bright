-- Clean up: any lead sitting in live_open_pool that has actually been worked
-- (has an owner/assignee, has been called, or has moved past 'new') must be
-- moved out of the pool. The popup and take-next RPC already ignore these,
-- but leaving them tagged with queue='live_open_pool' is misleading in the DB.
UPDATE public.sales_leads
   SET queue = CASE
                 WHEN owner_agent IS NOT NULL OR assigned_to IS NOT NULL
                   THEN 'owned_by_agent'
                 ELSE 'retry_queue'
               END
 WHERE queue = 'live_open_pool'
   AND (
        status <> 'new'
     OR COALESCE(call_count, 0) > 0
     OR last_contacted_at IS NOT NULL
     OR assigned_to IS NOT NULL
     OR owner_agent IS NOT NULL
   );