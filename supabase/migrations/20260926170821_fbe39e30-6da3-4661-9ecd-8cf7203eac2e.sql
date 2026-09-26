REVOKE EXECUTE ON FUNCTION public.protect_agent_sales_history() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_admin_user_cascade(uuid) FROM PUBLIC, anon;