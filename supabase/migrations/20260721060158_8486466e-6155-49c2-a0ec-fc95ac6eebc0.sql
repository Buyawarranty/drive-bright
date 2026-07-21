WITH ring_events AS (
  SELECT z.id,
         MAX((elem->>'ended_at')::bigint) AS ring_end_unix
  FROM public.zoiper_call_events z,
       LATERAL jsonb_array_elements(COALESCE(z.raw_payload->'events', '[]'::jsonb)) elem
  WHERE z.status = 'answered'
    AND (elem->>'ringing')::boolean = true
    AND elem->>'ended_at' IS NOT NULL
  GROUP BY z.id
)
UPDATE public.zoiper_call_events z
SET answered_at = to_timestamp(re.ring_end_unix) AT TIME ZONE 'UTC'
FROM ring_events re
WHERE z.id = re.id
  AND (z.answered_at IS NULL
       OR abs(extract(epoch from (z.answered_at - z.started_at))) < 0.5);