ALTER TABLE public.whatsapp_auto_message_queue
  ADD COLUMN IF NOT EXISTS wati_message_id text;

CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_wati_message_id
  ON public.whatsapp_auto_message_queue (wati_message_id);

CREATE OR REPLACE FUNCTION public.get_whatsapp_template_stats(_from timestamptz DEFAULT NULL, _to timestamptz DEFAULT NULL)
RETURNS TABLE (
  template_name text,
  queued bigint,
  sent bigint,
  delivered bigint,
  read_count bigint,
  failed bigint,
  skipped bigint,
  replied bigint,
  last_sent_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (
    SELECT
      COALESCE(k.template_name, 'unknown') AS template_name,
      k.status,
      k.sent_at,
      k.conversation_id,
      m.status AS msg_status
    FROM public.whatsapp_auto_message_queue k
    LEFT JOIN public.whatsapp_messages m ON m.wati_message_id = k.wati_message_id
    WHERE public.can_manage_lead_routing(auth.uid())
      AND (_from IS NULL OR k.created_at >= _from)
      AND (_to IS NULL OR k.created_at <= _to)
  )
  SELECT
    q.template_name,
    COUNT(*) FILTER (WHERE q.status = 'pending') AS queued,
    COUNT(*) FILTER (WHERE q.status = 'sent') AS sent,
    COUNT(*) FILTER (WHERE q.msg_status IN ('delivered', 'read')) AS delivered,
    COUNT(*) FILTER (WHERE q.msg_status = 'read') AS read_count,
    COUNT(*) FILTER (WHERE q.status = 'failed') AS failed,
    COUNT(*) FILTER (WHERE q.status = 'skipped') AS skipped,
    COUNT(*) FILTER (
      WHERE q.status = 'sent' AND q.conversation_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.whatsapp_messages r
        WHERE r.conversation_id = q.conversation_id
          AND r.direction = 'inbound'
          AND r.created_at >= q.sent_at
      )
    ) AS replied,
    MAX(q.sent_at) AS last_sent_at
  FROM q
  GROUP BY q.template_name
  ORDER BY MAX(q.sent_at) DESC NULLS LAST
$$;

GRANT EXECUTE ON FUNCTION public.get_whatsapp_template_stats(timestamptz, timestamptz) TO authenticated;