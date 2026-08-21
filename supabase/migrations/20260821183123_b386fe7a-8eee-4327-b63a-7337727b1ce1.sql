DROP INDEX IF EXISTS public.sales_leads_hidden_from_agent_ids_idx;
DROP INDEX IF EXISTS public.idx_sales_leads_recovery_worked_at;
DROP INDEX IF EXISTS public.idx_sales_leads_fake_audit_status;
DROP INDEX IF EXISTS public.idx_sales_leads_next_action_at;
DROP INDEX IF EXISTS public.idx_sales_leads_claim_count;
DROP INDEX IF EXISTS public.idx_sl_orr_pool_state;
DROP INDEX IF EXISTS public.sales_leads_do_not_contact_idx;
DROP INDEX IF EXISTS public.idx_sales_leads_save_cancellation;
DROP INDEX IF EXISTS public.idx_sales_leads_drip_release_at;

ANALYZE public.sales_leads;