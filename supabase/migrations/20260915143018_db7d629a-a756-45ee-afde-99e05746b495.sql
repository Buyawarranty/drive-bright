CREATE OR REPLACE FUNCTION public.delete_chat_thread(_thread_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _role text;
BEGIN
  SELECT role INTO _role
  FROM public.admin_users
  WHERE user_id = ( SELECT auth.uid() ) AND is_active = true
  LIMIT 1;

  IF _role IS NULL OR _role NOT IN ('admin','super_admin','sales_manager') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF _thread_id IS NULL THEN
    RETURN false;
  END IF;

  DELETE FROM public.ai_sandbox_messages WHERE thread_id = _thread_id;
  DELETE FROM public.ai_sandbox_handovers WHERE thread_id = _thread_id;
  DELETE FROM public.ai_chat_events WHERE thread_id = _thread_id;
  DELETE FROM public.ai_sandbox_threads WHERE id = _thread_id;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_chat_thread(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_chat_thread(uuid) TO authenticated;