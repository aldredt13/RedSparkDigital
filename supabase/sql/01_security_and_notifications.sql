-- ════════════════════════════════════════════════════════════════════════════
-- RedSparkDigital — security hardening + server-side Discord alerts
--
-- Run in: Supabase Dashboard → SQL Editor → paste all → Run.
-- Runs in one transaction: if anything fails, nothing is changed.
-- Safe to run more than once.
--
-- What it does
--   1. admin_users allowlist + is_admin() — only listed accounts can manage
--      content or read enquiries (today ANY signed-up account can).
--   2. Rebuilds RLS on every content table:
--        • public can read projects, testimonials, active plans/features
--        • public can read ONLY contact_*/social_*/business_* site settings
--          (the Discord webhook URL is no longer readable by visitors)
--        • public can submit the contact form, nothing else
--        • admins can do everything
--   3. Closes a hole where pricing_plans_full (a definer view) let anyone
--      update plans through the view, bypassing RLS.
--   4. Contact form guard: simple per-email rate limit + length checks.
--   5. Discord alert sent by the database (pg_net) on every new enquiry, so
--      the webhook never has to be exposed to the browser.
--   6. Public "portfolio" storage bucket so admins can upload project images.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ─── 1. Admin allowlist ─────────────────────────────────────────────────────

create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

drop policy if exists admin_users_read_self on public.admin_users;
create policy admin_users_read_self on public.admin_users
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Edit this list if the admins change. Both accounts already exist in auth.users.
insert into public.admin_users (user_id, email)
select id, email
from auth.users
where lower(email) in ('redsparkdigital@gmail.com', 'aldredt13@gmail.com')
on conflict (user_id) do nothing;

do $$
begin
  if not exists (select 1 from public.admin_users) then
    raise exception 'No admin accounts matched — fix the email list in section 1 before running.';
  end if;
end $$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_users where user_id = (select auth.uid()));
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;


-- ─── 2. Rebuild RLS policies ────────────────────────────────────────────────
-- Drop every existing policy on these tables (there are duplicates and
-- "any authenticated user" rules), then recreate a clean, minimal set.

do $$
declare p record;
begin
  for p in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('contact_submissions', 'portfolio_projects', 'testimonials',
                        'pricing_plans', 'pricing_features', 'site_settings')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

alter table public.contact_submissions enable row level security;
alter table public.portfolio_projects  enable row level security;
alter table public.testimonials        enable row level security;
alter table public.pricing_plans       enable row level security;
alter table public.pricing_features    enable row level security;
alter table public.site_settings       enable row level security;

-- Portfolio projects
create policy projects_read_public on public.portfolio_projects
  for select to anon, authenticated using (true);
create policy projects_admin_write on public.portfolio_projects
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Testimonials
create policy testimonials_read_public on public.testimonials
  for select to anon, authenticated using (true);
create policy testimonials_admin_write on public.testimonials
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Pricing plans (visitors only see active ones)
create policy plans_read_public on public.pricing_plans
  for select to anon, authenticated
  using (active or (select public.is_admin()));
create policy plans_admin_write on public.pricing_plans
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Pricing features (visitors only see features of active plans)
create policy features_read_public on public.pricing_features
  for select to anon, authenticated
  using (
    exists (select 1 from public.pricing_plans p where p.id = plan_id and p.active)
    or (select public.is_admin())
  );
create policy features_admin_write on public.pricing_features
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Site settings: only display keys are public; secrets (webhook etc.) are admin-only
create policy settings_read_public on public.site_settings
  for select to anon, authenticated
  using (key ~ '^(contact|social|business)_' or (select public.is_admin()));
create policy settings_admin_write on public.site_settings
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Contact submissions: anyone can submit, only admins can read/manage
create policy submissions_insert_public on public.contact_submissions
  for insert to anon, authenticated
  with check (status = 'unread');
create policy submissions_admin_all on public.contact_submissions
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));


-- ─── 3. Grants hygiene + definer view fix ───────────────────────────────────

-- The view ran as its owner, so RLS was skipped — including for UPDATEs
-- through the view. Run it as the caller instead, and make it read-only.
alter view public.pricing_plans_full set (security_invoker = true);
revoke insert, update, delete, truncate on public.pricing_plans_full from anon, authenticated;

-- Nobody needs these through the API
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;


-- ─── 4. Contact form guard ──────────────────────────────────────────────────

alter table public.contact_submissions drop constraint if exists contact_submissions_phone_check;
alter table public.contact_submissions drop constraint if exists contact_submissions_service_check;
alter table public.contact_submissions
  add constraint contact_submissions_phone_check
    check (phone is null or char_length(phone) <= 40) not valid,
  add constraint contact_submissions_service_check
    check (char_length(service) between 1 and 200) not valid;

create or replace function public.contact_submissions_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.status := 'unread';
  new.email  := lower(trim(new.email));

  -- At most 3 enquiries per email address per 10 minutes
  if (
    select count(*) from public.contact_submissions
    where email = new.email and created_at > now() - interval '10 minutes'
  ) >= 3 then
    raise exception 'Too many messages from this email address. Please wait a few minutes and try again.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.contact_submissions_before_insert() from public, anon, authenticated;

drop trigger if exists contact_submissions_before_insert on public.contact_submissions;
create trigger contact_submissions_before_insert
  before insert on public.contact_submissions
  for each row execute function public.contact_submissions_before_insert();


-- ─── 5. Discord alert from the database ─────────────────────────────────────
-- pg_net queues the HTTP call and sends it after the insert commits, so a
-- slow or broken webhook can never block or fail a visitor's submission.

create extension if not exists pg_net with schema extensions;

create or replace function public.contact_submissions_notify_discord()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url     text;
  v_enabled text;
  v_price   integer;
  v_fields  jsonb;
begin
  select value into v_url     from public.site_settings where key = 'discord_webhook_url';
  select value into v_enabled from public.site_settings where key = 'discord_notifications_enabled';

  if coalesce(v_enabled, 'true') <> 'true'
     or coalesce(v_url, '') !~ '^https://((ptb|canary)\.)?discord(app)?\.com/api/webhooks/' then
    return new;
  end if;

  v_fields := jsonb_build_array(
    jsonb_build_object('name', 'Name',    'value', left(new.name, 1024),  'inline', true),
    jsonb_build_object('name', 'Email',   'value', left(new.email, 1024), 'inline', true),
    jsonb_build_object('name', 'Phone',   'value', coalesce(nullif(trim(new.phone), ''), '—'), 'inline', true),
    jsonb_build_object('name', 'Service', 'value', left(new.service, 1024), 'inline', false)
  );

  -- Package enquiries are stored as "Package: <plan name>"
  if new.service like 'Package: %' then
    select price_usd_cents into v_price
    from public.pricing_plans
    where name = substr(new.service, 10)
    limit 1;

    if v_price is not null then
      v_fields := v_fields || jsonb_build_array(jsonb_build_object(
        'name',   'Package price',
        'value',  'from $' || to_char(v_price / 100.0, 'FM999999990.00') || ' USD',
        'inline', true
      ));
    end if;
  end if;

  v_fields := v_fields || jsonb_build_array(
    jsonb_build_object('name', 'Message', 'value', left(new.message, 1024), 'inline', false)
  );

  perform net.http_post(
    url     := v_url,
    body    := jsonb_build_object('embeds', jsonb_build_array(jsonb_build_object(
                 'title',     '📬 New enquiry — ' || left(new.service, 200),
                 'color',     14701909,
                 'fields',    v_fields,
                 'footer',    jsonb_build_object('text', 'RedSpark Digital · Contact form'),
                 'timestamp', to_char(new.created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
               ))),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );

  return new;
exception when others then
  -- Never lose an enquiry because of a notification problem
  raise warning 'Discord notification failed: %', sqlerrm;
  return new;
end;
$$;

revoke all on function public.contact_submissions_notify_discord() from public, anon, authenticated;

drop trigger if exists contact_submissions_notify_discord on public.contact_submissions;
create trigger contact_submissions_notify_discord
  after insert on public.contact_submissions
  for each row execute function public.contact_submissions_notify_discord();


-- ─── 6. Portfolio image uploads ─────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio', 'portfolio', true, 5242880,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists portfolio_admin_read   on storage.objects;
drop policy if exists portfolio_admin_insert on storage.objects;
drop policy if exists portfolio_admin_update on storage.objects;
drop policy if exists portfolio_admin_delete on storage.objects;

create policy portfolio_admin_read on storage.objects
  for select to authenticated
  using (bucket_id = 'portfolio' and (select public.is_admin()));
create policy portfolio_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'portfolio' and (select public.is_admin()));
create policy portfolio_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'portfolio' and (select public.is_admin()));
create policy portfolio_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'portfolio' and (select public.is_admin()));

commit;


-- ─── Result: the policies now in place ──────────────────────────────────────
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
