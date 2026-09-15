CREATE OR REPLACE FUNCTION public.get_whatsapp_reply_notifications(_since timestamptz DEFAULT (now() - interval '24 hours'))
RETURNS TABLE (
  message_id uuid,
  conversation_id uuid,
  lead_id uuid,
  customer_name text,
  phone text,
  message_preview text,
  replied_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH caller AS (
    SELECT au.id, au.role
    FROM public.admin_users au
    WHERE au.user_id = (SELECT auth.uid())
      AND au.is_active = true
    ORDER BY au.created_at DESC
    LIMIT 1
  )
  SELECT
    wm.id AS message_id,
    wc.id AS conversation_id,
    wc.lead_id,
    COALESCE(NULLIF(wc.display_name, ''), NULLIF(concat_ws(' ', sl.first_name, sl.last_name), ''), wc.phone) AS customer_name,
    wc.phone,
    LEFT(COALESCE(NULLIF(wm.body, ''), CASE WHEN wm.media_type IS NOT NULL THEN '[' || wm.media_type || ']' ELSE 'New WhatsApp reply' END), 240) AS message_preview,
    COALESCE(wm.wati_timestamp, wm.created_at) AS replied_at
  FROM public.whatsapp_messages wm
  JOIN public.whatsapp_conversations wc ON wc.id = wm.conversation_id
  LEFT JOIN public.sales_leads sl ON sl.id = wc.lead_id
  CROSS JOIN caller c
  WHERE wm.direction = 'inbound'
    AND COALESCE(wm.wati_timestamp, wm.created_at) >= GREATEST(_since, now() - interval '7 days')
    AND (
      c.role IN ('admin', 'super_admin', 'sales_manager')
      OR wc.assigned_to = c.id
      OR sl.assigned_to = c.id
      OR sl.owner_agent = c.id
    )
  ORDER BY COALESCE(wm.wati_timestamp, wm.created_at) DESC
  LIMIT 100;
$$;

REVOKE ALL ON FUNCTION public.get_whatsapp_reply_notifications(timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_whatsapp_reply_notifications(timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_reply_notifications(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_reply_notifications(timestamptz) TO service_role;