alter table public.admin_users
  add column if not exists pinned_shortcuts text[] not null default '{}';

create or replace function public.get_pinned_shortcuts()
returns text[]
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select pinned_shortcuts from public.admin_users where user_id = auth.uid()),
    '{}'::text[]
  );
$$;

create or replace function public.save_pinned_shortcuts(ids text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  update public.admin_users
    set pinned_shortcuts = coalesce(ids, '{}')
    where user_id = auth.uid();
end;
$$;

revoke all on function public.get_pinned_shortcuts() from public, anon;
revoke all on function public.save_pinned_shortcuts(text[]) from public, anon;
grant execute on function public.get_pinned_shortcuts() to authenticated;
grant execute on function public.save_pinned_shortcuts(text[]) to authenticated;