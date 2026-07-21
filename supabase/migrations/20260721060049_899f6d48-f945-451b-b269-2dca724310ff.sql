-- Backfill answered_at for existing Dial 9 rows using the same logic the edge function will use going forward:
--   answered_at = MAX(ended_at) across Extension events with ringing=true.
--   Fallback: ended_at - talk_seconds for answered calls where no ringing event is present.
WITH ext_ring AS (
  SELECT z.id,
         MAX((elem->>'ended_at')::bigint) AS ring_end_unix
  FROM public.zoiper_call_events z,
       LATERAL jsonb_array_elements(COALESCE(z.raw_payload->'events', '[]'::jsonb)) elem
  WHERE z.status = 'answered'
    AND z.answered_at IS NULL
    AND z.raw_payload->>'source' = 'dial9'
    AND lower(elem->>'type') = 'extension'
    AND (elem->>'ringing')::boolean = true
    AND elem->>'ended_at' IS NOT NULL
  GROUP BY z.id
)
UPDATE public.zoiper_call_events z
SET answered_at = to_timestamp(er.ring_end_unix) AT TIME ZONE 'UTC'
FROM ext_ring er
WHERE z.id = er.id;

-- Fallback for the small tail with no ringing Extension event
UPDATE public.zoiper_call_events
SET answered_at = ended_at - make_interval(secs => talk_seconds)
WHERE status = 'answered'
  AND answered_at IS NULL
  AND ended_at IS NOT NULL
  AND talk_seconds IS NOT NULL
  AND talk_seconds > 0
  AND raw_payload->>'source' = 'dial9';