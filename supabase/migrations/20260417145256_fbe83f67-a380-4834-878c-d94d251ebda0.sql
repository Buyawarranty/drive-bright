WITH recent AS (
  SELECT id, lower(btrim(email)) AS norm_email,
    assigned_to, call_count, notes, last_contacted_at, updated_at, created_at
  FROM public.sales_leads
  WHERE email IS NOT NULL
    AND btrim(email) != ''
    AND status NOT IN ('converted','lost','fake_lead')
    AND created_at > now() - interval '90 days'
),
ranked AS (
  SELECT id, norm_email,
    ROW_NUMBER() OVER (
      PARTITION BY norm_email
      ORDER BY
        CASE WHEN assigned_to IS NOT NULL THEN 0 ELSE 1 END,
        CASE WHEN call_count > 0 OR notes IS NOT NULL OR last_contacted_at IS NOT NULL THEN 0 ELSE 1 END,
        updated_at DESC,
        created_at DESC
    ) AS rn,
    COUNT(*) OVER (PARTITION BY norm_email) AS cnt
  FROM recent
),
keepers AS (
  SELECT norm_email, id AS keep_id FROM ranked WHERE rn = 1 AND cnt > 1
)
UPDATE public.sales_leads sl
SET status = 'lost'::lead_status,
  lost_at = COALESCE(sl.lost_at, now()),
  lost_reason = COALESCE(sl.lost_reason, 'Auto-merged duplicate of ' || k.keep_id::text),
  notes = COALESCE(sl.notes, '') || E'\n[SYSTEM] Auto-archived as duplicate of lead ' || k.keep_id::text,
  updated_at = now()
FROM ranked r
JOIN keepers k ON k.norm_email = r.norm_email
WHERE sl.id = r.id
  AND r.rn > 1
  AND sl.status NOT IN ('converted','lost','fake_lead');