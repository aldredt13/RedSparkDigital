-- ════════════════════════════════════════════════════════════════════════════
-- RedSparkDigital — READ-ONLY schema inspection
--
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- Returns ONE cell of JSON. Copy that whole cell and paste it back.
-- Nothing here writes or changes anything.
-- ════════════════════════════════════════════════════════════════════════════

select jsonb_pretty(jsonb_build_object(

  -- Tables + views in `public`: columns, constraints, indexes, triggers, grants, RLS flags
  'tables', (
    select jsonb_agg(jsonb_build_object(
      'table',        c.relname,
      'kind',         case c.relkind when 'r' then 'table' when 'v' then 'view' when 'm' then 'matview' when 'p' then 'partitioned' end,
      'rls_enabled',  c.relrowsecurity,
      'rls_forced',   c.relforcerowsecurity,
      'columns', (
        select jsonb_agg(jsonb_build_object(
          'name',     a.attname,
          'type',     format_type(a.atttypid, a.atttypmod),
          'not_null', a.attnotnull,
          'default',  pg_get_expr(d.adbin, d.adrelid)
        ) order by a.attnum)
        from pg_attribute a
        left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
        where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
      ),
      'constraints', (
        select jsonb_agg(jsonb_build_object('name', con.conname, 'def', pg_get_constraintdef(con.oid)))
        from pg_constraint con where con.conrelid = c.oid
      ),
      'indexes',  (select jsonb_agg(pg_get_indexdef(i.indexrelid)) from pg_index i where i.indrelid = c.oid),
      'triggers', (select jsonb_agg(pg_get_triggerdef(t.oid)) from pg_trigger t where t.tgrelid = c.oid and not t.tgisinternal),
      'grants', (
        select jsonb_object_agg(g.grantee, g.privs) from (
          select grantee, jsonb_agg(privilege_type order by privilege_type) as privs
          from information_schema.role_table_grants
          where table_schema = 'public' and table_name = c.relname
            and grantee in ('anon', 'authenticated')
          group by grantee
        ) g
      ),
      'view_definition', case when c.relkind in ('v', 'm') then pg_get_viewdef(c.oid, true) end
    ) order by c.relname)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p')
  ),

  -- Every RLS policy (public + storage)
  'policies', (
    select jsonb_agg(jsonb_build_object(
      'schema', p.schemaname, 'table', p.tablename, 'name', p.policyname,
      'permissive', p.permissive, 'roles', p.roles, 'cmd', p.cmd,
      'using', p.qual, 'with_check', p.with_check
    ) order by p.schemaname, p.tablename, p.policyname)
    from pg_policies p
    where p.schemaname in ('public', 'storage')
  ),

  -- User-defined functions in `public` (skips extension-owned ones)
  'functions', (
    select jsonb_agg(jsonb_build_object(
      'name', p.proname,
      'security_definer', p.prosecdef,
      'definition', pg_get_functiondef(p.oid)
    ) order by p.proname)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and not exists (select 1 from pg_depend dep where dep.objid = p.oid and dep.deptype = 'e')
  ),

  'extensions_installed', (select jsonb_agg(jsonb_build_object('name', extname, 'version', extversion) order by extname) from pg_extension),
  'pg_net_available',     (select count(*) > 0 from pg_available_extensions where name = 'pg_net'),

  'storage_buckets', (select jsonb_agg(jsonb_build_object('id', id, 'public', public)) from storage.buckets),

  -- Who can sign in to /admin (check for accounts you don't recognise)
  'auth_users', (
    select jsonb_agg(jsonb_build_object(
      'email', email,
      'created_at', created_at,
      'last_sign_in_at', last_sign_in_at,
      'email_confirmed', email_confirmed_at is not null
    ) order by created_at)
    from auth.users
  ),

  -- site_settings keys only (values may hold secrets, so they are not included)
  'site_settings_keys', (select jsonb_agg(key order by key) from public.site_settings)

)) as schema_report;
