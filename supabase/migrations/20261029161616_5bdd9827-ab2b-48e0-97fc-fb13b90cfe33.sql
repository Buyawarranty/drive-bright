
-- ===== 1. Staff leaver archive =====
CREATE TABLE public.staff_leaver_archives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  auth_user_id uuid,
  staff_name text,
  staff_email text,
  staff_role text,
  trigger_reason text NOT NULL,
  profile_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'building',
  table_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_records integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE TABLE public.staff_leaver_archive_items (
  id bigserial PRIMARY KEY,
  archive_id uuid NOT NULL REFERENCES public.staff_leaver_archives(id),
  source_table text NOT NULL,
  matched_column text NOT NULL,
  row_data jsonb NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.staff_leaver_archive_items(archive_id, source_table);
CREATE INDEX ON public.staff_leaver_archives(admin_user_id);

GRANT SELECT ON public.staff_leaver_archives, public.staff_leaver_archive_items TO authenticated;
GRANT ALL ON public.staff_leaver_archives, public.staff_leaver_archive_items TO service_role;
GRANT USAGE ON SEQUENCE public.staff_leaver_archive_items_id_seq TO service_role;
ALTER TABLE public.staff_leaver_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_leaver_archive_items ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_active_admin_or_super(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id=_uid AND is_active AND role IN ('admin','super_admin'));
$$;

CREATE POLICY "Admins view leaver archives" ON public.staff_leaver_archives FOR SELECT TO authenticated
  USING (public.is_active_admin_or_super(auth.uid()));
CREATE POLICY "Admins view leaver archive items" ON public.staff_leaver_archive_items FOR SELECT TO authenticated
  USING (public.is_active_admin_or_super(auth.uid()));

-- Immutability: items can never change; archives can only move building -> complete.
CREATE OR REPLACE FUNCTION public.staff_leaver_archive_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'staff_leaver_archive_items' THEN
    RAISE EXCEPTION 'Leaver archive records are locked';
  END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Leaver archives cannot be deleted'; END IF;
  IF OLD.status = 'complete' THEN RAISE EXCEPTION 'Completed leaver archives are locked'; END IF;
  IF NEW.admin_user_id <> OLD.admin_user_id OR NEW.profile_snapshot <> OLD.profile_snapshot OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'Leaver archive identity is locked';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER staff_leaver_archives_lock BEFORE UPDATE OR DELETE ON public.staff_leaver_archives
  FOR EACH ROW EXECUTE FUNCTION public.staff_leaver_archive_guard();
CREATE TRIGGER staff_leaver_archive_items_lock BEFORE UPDATE OR DELETE ON public.staff_leaver_archive_items
  FOR EACH ROW EXECUTE FUNCTION public.staff_leaver_archive_guard();

-- Tables/columns that reference a staff member.
CREATE OR REPLACE FUNCTION public.staff_archive_sources()
RETURNS TABLE(table_name text, column_name text, data_type text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.table_name::text, c.column_name::text, c.data_type::text
  FROM information_schema.columns c
  JOIN information_schema.tables t ON t.table_schema='public' AND t.table_name=c.table_name AND t.table_type='BASE TABLE'
  WHERE c.table_schema='public'
    AND c.data_type IN ('uuid','text')
    AND c.table_name NOT IN ('staff_leaver_archives','staff_leaver_archive_items')
    AND c.column_name IN ('admin_user_id','agent_id','user_id','actor_id','actor_admin_user_id','actor_user_id',
      'performed_by','created_by','changed_by','executed_by','assigned_to','staff_id','admin_id',
      'sale_credit_admin_user_id','agent_admin_user_id','caller_admin_user_id','viewer_admin_user_id',
      'requested_by','approved_by','reviewed_by','decided_by','source_admin_user_id','target_admin_user_id',
      'invited_by','restored_by','updated_by','deleted_by','claimed_by','owner_admin_user_id')
  ORDER BY 1,2;
$$;
REVOKE ALL ON FUNCTION public.staff_archive_sources() FROM PUBLIC, anon, authenticated;

-- Copy one table's matching rows into an archive (idempotent per table while building).
CREATE OR REPLACE FUNCTION public.staff_archive_copy_table(_archive_id uuid, _table text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; src record; n integer := 0; cnt integer; cond text := '';
BEGIN
  SELECT * INTO a FROM public.staff_leaver_archives WHERE id=_archive_id;
  IF a.id IS NULL OR a.status <> 'building' THEN RETURN 0; END IF;
  IF EXISTS (SELECT 1 FROM public.staff_leaver_archive_items WHERE archive_id=_archive_id AND source_table=_table) THEN RETURN 0; END IF;
  FOR src IN SELECT * FROM public.staff_archive_sources() s WHERE s.table_name=_table LOOP
    IF src.data_type='uuid' THEN
      EXECUTE format('INSERT INTO public.staff_leaver_archive_items(archive_id,source_table,matched_column,row_data)
        SELECT $1,%L,%L,to_jsonb(t) FROM public.%I t WHERE t.%I = ANY($2)', _table, src.column_name, _table, src.column_name)
        USING _archive_id, ARRAY[a.admin_user_id, a.auth_user_id]::uuid[];
    ELSE
      EXECUTE format('INSERT INTO public.staff_leaver_archive_items(archive_id,source_table,matched_column,row_data)
        SELECT $1,%L,%L,to_jsonb(t) FROM public.%I t WHERE t.%I = ANY($2)', _table, src.column_name, _table, src.column_name)
        USING _archive_id, ARRAY[a.admin_user_id::text, a.auth_user_id::text];
    END IF;
    GET DIAGNOSTICS cnt = ROW_COUNT; n := n + cnt;
  END LOOP;
  UPDATE public.staff_leaver_archives SET table_counts = table_counts || jsonb_build_object(_table, n),
    total_records = total_records + n WHERE id=_archive_id;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.staff_archive_copy_table(uuid,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_archive_build_all(_archive_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tbl text;
BEGIN
  FOR tbl IN SELECT DISTINCT table_name FROM public.staff_archive_sources() LOOP
    PERFORM public.staff_archive_copy_table(_archive_id, tbl);
  END LOOP;
  UPDATE public.staff_leaver_archives SET status='complete', completed_at=now() WHERE id=_archive_id AND status='building';
END $$;
REVOKE ALL ON FUNCTION public.staff_archive_build_all(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_archive_open(_admin public.admin_users, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.staff_leaver_archives(admin_user_id, auth_user_id, staff_name, staff_email, staff_role, trigger_reason, profile_snapshot, created_by)
  VALUES (_admin.id, _admin.user_id, trim(coalesce(_admin.first_name,'')||' '||coalesce(_admin.last_name,'')), _admin.email, _admin.role::text,
          _reason, to_jsonb(_admin), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.staff_archive_open(public.admin_users, text) FROM PUBLIC, anon, authenticated;

-- Automatic: open archive on deactivate/archive/expire/block; build fully before removal.
CREATE OR REPLACE FUNCTION public.staff_leaver_archive_on_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_id := public.staff_archive_open(OLD, 'removed');
    PERFORM public.staff_archive_build_all(v_id);
    RETURN OLD;
  END IF;
  IF (OLD.is_active AND NOT NEW.is_active) OR (OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL) THEN
    IF NOT EXISTS (SELECT 1 FROM public.staff_leaver_archives WHERE admin_user_id=NEW.id AND status='building') THEN
      PERFORM public.staff_archive_open(NEW, CASE WHEN NEW.archived_at IS NOT NULL AND OLD.archived_at IS NULL THEN 'archived' ELSE 'deactivated' END);
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER admin_users_leaver_archive_update AFTER UPDATE OF is_active, archived_at ON public.admin_users
  FOR EACH ROW EXECUTE FUNCTION public.staff_leaver_archive_on_change();
CREATE TRIGGER admin_users_leaver_archive_delete BEFORE DELETE ON public.admin_users
  FOR EACH ROW EXECUTE FUNCTION public.staff_leaver_archive_on_change();

-- Admin-callable: list pending tables, copy one table, finish, and manual open.
CREATE OR REPLACE FUNCTION public.leaver_archive_pending_tables(_archive_id uuid)
RETURNS SETOF text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_active_admin_or_super(auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  RETURN QUERY SELECT DISTINCT s.table_name FROM public.staff_archive_sources() s
    WHERE NOT (s.table_name IN (SELECT jsonb_object_keys(table_counts) FROM public.staff_leaver_archives WHERE id=_archive_id))
    ORDER BY 1;
END $$;
CREATE OR REPLACE FUNCTION public.leaver_archive_copy_table(_archive_id uuid, _table text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_active_admin_or_super(auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.staff_archive_sources() s WHERE s.table_name=_table) THEN RAISE EXCEPTION 'Unknown source'; END IF;
  RETURN public.staff_archive_copy_table(_archive_id, _table);
END $$;
CREATE OR REPLACE FUNCTION public.leaver_archive_finish(_archive_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_active_admin_or_super(auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF EXISTS (SELECT 1 FROM public.leaver_archive_pending_tables(_archive_id)) THEN RAISE EXCEPTION 'Archive still has tables to copy'; END IF;
  UPDATE public.staff_leaver_archives SET status='complete', completed_at=now() WHERE id=_archive_id AND status='building';
END $$;
CREATE OR REPLACE FUNCTION public.leaver_archive_start(_admin_user_id uuid, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.admin_users; v uuid;
BEGIN
  IF NOT public.is_active_admin_or_super(auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  SELECT * INTO r FROM public.admin_users WHERE id=_admin_user_id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Staff member not found'; END IF;
  SELECT id INTO v FROM public.staff_leaver_archives WHERE admin_user_id=r.id AND status='building' LIMIT 1;
  IF v IS NOT NULL THEN RETURN v; END IF;
  RETURN public.staff_archive_open(r, coalesce(nullif(trim(_reason),''),'manual'));
END $$;
REVOKE ALL ON FUNCTION public.leaver_archive_pending_tables(uuid), public.leaver_archive_copy_table(uuid,text), public.leaver_archive_finish(uuid), public.leaver_archive_start(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leaver_archive_pending_tables(uuid), public.leaver_archive_copy_table(uuid,text), public.leaver_archive_finish(uuid), public.leaver_archive_start(uuid,text) TO authenticated;

-- ===== 2. Two-month customer window for sales/sales_lead =====
CREATE TABLE public.customer_history_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  requester_admin_user_id uuid NOT NULL,
  search_value text NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  decided_by uuid,
  decided_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.customer_history_access_requests(requester_admin_user_id, customer_id);
GRANT SELECT ON public.customer_history_access_requests TO authenticated;
GRANT ALL ON public.customer_history_access_requests TO service_role;
ALTER TABLE public.customer_history_access_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Requester or management view history requests" ON public.customer_history_access_requests FOR SELECT TO authenticated
  USING (requester_admin_user_id = public.current_admin_user_id() OR public.is_management(auth.uid()));

CREATE OR REPLACE FUNCTION public.is_two_month_sales_scope(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id=_uid AND is_active AND role IN ('sales','sales_lead'));
$$;

CREATE OR REPLACE FUNCTION public.sales_can_see_customer(_customer_id uuid, _assigned uuid, _credit uuid, _signup timestamptz)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (public.current_admin_user_id() IN (_assigned, _credit) AND coalesce(_signup, now()) >= now() - interval '2 months')
    OR EXISTS (SELECT 1 FROM public.customer_history_access_requests r
       WHERE r.customer_id=_customer_id AND r.requester_admin_user_id=public.current_admin_user_id()
         AND r.status='approved' AND r.expires_at > now());
$$;

DROP POLICY "Active staff can view all customers" ON public.customers;
CREATE POLICY "Active staff can view customers" ON public.customers FOR SELECT TO authenticated
  USING (public.is_active_admin_user(auth.uid()) AND (
    NOT public.is_two_month_sales_scope(auth.uid())
    OR public.sales_can_see_customer(id, assigned_to, sale_credit_admin_user_id, signup_date)));
DROP POLICY "Active staff can update all customers" ON public.customers;
CREATE POLICY "Active staff can update customers" ON public.customers FOR UPDATE TO authenticated
  USING (public.is_active_admin_user(auth.uid()) AND (
    NOT public.is_two_month_sales_scope(auth.uid())
    OR public.sales_can_see_customer(id, assigned_to, sale_credit_admin_user_id, signup_date)));

CREATE OR REPLACE FUNCTION public.request_customer_history_access(_search text, _reason text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := public.current_admin_user_id(); s text := lower(trim(_search)); sc text; n integer;
BEGIN
  IF NOT public.is_two_month_sales_scope(auth.uid()) THEN RAISE EXCEPTION 'Only sales staff need to request access'; END IF;
  IF length(coalesce(trim(_reason),'')) < 5 THEN RAISE EXCEPTION 'Please give a reason'; END IF;
  IF length(coalesce(s,'')) < 4 THEN RAISE EXCEPTION 'Enter a full registration or email'; END IF;
  sc := regexp_replace(s,'[^a-z0-9]','','g');
  INSERT INTO public.customer_history_access_requests(customer_id, requester_admin_user_id, search_value, reason)
  SELECT c.id, me, trim(_search), trim(_reason) FROM public.customers c
  WHERE (lower(c.email)=s OR regexp_replace(lower(coalesce(c.registration_plate,'')),'[^a-z0-9]','','g')=sc)
    AND NOT EXISTS (SELECT 1 FROM public.customer_history_access_requests r WHERE r.customer_id=c.id
      AND r.requester_admin_user_id=me AND (r.status='pending' OR (r.status='approved' AND r.expires_at>now())))
  LIMIT 10;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.decide_customer_history_access(_request_id uuid, _approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_management(auth.uid()) THEN RAISE EXCEPTION 'Only managers can decide'; END IF;
  UPDATE public.customer_history_access_requests
    SET status = CASE WHEN _approve THEN 'approved' ELSE 'declined' END,
        decided_by = public.current_admin_user_id(), decided_at = now(),
        expires_at = CASE WHEN _approve THEN now() + interval '24 hours' END
    WHERE id=_request_id AND status='pending';
END $$;

CREATE OR REPLACE FUNCTION public.list_customer_history_requests()
RETURNS TABLE(id uuid, customer_name text, registration_plate text, signup_date timestamptz, requester_name text,
  search_value text, reason text, status text, created_at timestamptz, expires_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_management(auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  RETURN QUERY SELECT r.id, c.name, c.registration_plate, c.signup_date,
    trim(coalesce(a.first_name,'')||' '||coalesce(a.last_name,'')), r.search_value, r.reason, r.status, r.created_at, r.expires_at
  FROM public.customer_history_access_requests r
  LEFT JOIN public.customers c ON c.id=r.customer_id
  LEFT JOIN public.admin_users a ON a.id=r.requester_admin_user_id
  ORDER BY (r.status='pending') DESC, r.created_at DESC LIMIT 200;
END $$;
REVOKE ALL ON FUNCTION public.request_customer_history_access(text,text), public.decide_customer_history_access(uuid,boolean), public.list_customer_history_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_customer_history_access(text,text), public.decide_customer_history_access(uuid,boolean), public.list_customer_history_requests() TO authenticated;
