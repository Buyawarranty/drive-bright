create or replace function public.get_bumper_transaction_for_fallback(p_transaction_id text)
returns table (
  transaction_id text,
  plan_id text,
  payment_type text,
  customer_data jsonb,
  vehicle_data jsonb,
  protection_addons jsonb,
  final_amount numeric,
  discount_code text,
  claim_limit numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select bt.transaction_id::text,
         bt.plan_id::text,
         bt.payment_type::text,
         bt.customer_data::jsonb,
         bt.vehicle_data::jsonb,
         bt.protection_addons::jsonb,
         bt.final_amount::numeric,
         bt.discount_code::text,
         bt.claim_limit::numeric
  from public.bumper_transactions bt
  where bt.transaction_id = p_transaction_id
  order by bt.created_at desc
  limit 1
$$;

grant execute on function public.get_bumper_transaction_for_fallback(text) to anon, authenticated, service_role;