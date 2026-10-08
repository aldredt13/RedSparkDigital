-- ════════════════════════════════════════════════════════════════════════════
-- RedSparkDigital — first-party website analytics            (site v2.1.0)
--
-- Run in: Supabase Dashboard → SQL Editor → paste all → Run.
-- Requires 01_security_and_notifications.sql (uses public.is_admin()).
-- Runs in one transaction and is safe to run more than once.
--
-- What it adds
--   • analytics_events   — one row per page view / interaction / engagement ping
--   • track_events()     — the only way visitors can write (no direct table access);
--                          captures the visitor IP from the request headers
--   • analytics_report() — everything the dashboard's Analytics tab shows, aggregated
--   • analytics_visitor()— one visitor's full timeline
--   • analytics_live()   — who's on the site right now
--
-- Retention: IP addresses are cleared after 90 days, events deleted after 13 months.
-- ════════════════════════════════════════════════════════════════════════════

begin;

do $$
begin
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'Run 01_security_and_notifications.sql first (public.is_admin() is missing).';
  end if;
end $$;

-- ─── Table ──────────────────────────────────────────────────────────────────

create table if not exists public.analytics_events (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  visitor_id   text not null,          -- random id kept in the visitor's browser
  session_id   text not null,          -- new after 30 minutes of inactivity
  type         text not null check (type in ('pageview', 'event', 'engagement')),
  name         text,                   -- event name, e.g. whatsapp_click, contact_submit, section_view
  path         text,
  referrer     text,                   -- referring site (host only); null = direct
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  device       text,                   -- mobile | tablet | desktop
  browser      text,
  os           text,
  screen       text,                   -- e.g. 390x844
  language     text,
  timezone     text,
  country      text,                   -- ISO code, e.g. NA
  region       text,
  city         text,
  ip           text,
  duration_s   integer,                -- engagement: active seconds so far this session
  scroll_pct   smallint,               -- engagement: deepest scroll, 0–100
  props        jsonb                   -- extra event details, e.g. {"service": "Website Development"}
);

create index if not exists analytics_events_created_at_idx on public.analytics_events (created_at desc);
create index if not exists analytics_events_visitor_idx    on public.analytics_events (visitor_id, created_at desc);
create index if not exists analytics_events_session_idx    on public.analytics_events (session_id);

alter table public.analytics_events enable row level security;

-- Visitors never touch the table directly; admins can read and delete (e.g. "forget visitor")
drop policy if exists analytics_admin_all on public.analytics_events;
create policy analytics_admin_all on public.analytics_events
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.analytics_events from anon;
revoke insert, update, truncate, references, trigger on public.analytics_events from authenticated;


-- ─── Collector ──────────────────────────────────────────────────────────────

create or replace function public.track_events(p_context jsonb, p_events jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_headers jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  v_visitor text  := p_context->>'visitor_id';
  v_session text  := p_context->>'session_id';
  v_ip      text;
begin
  if coalesce(v_visitor, '') !~ '^[A-Za-z0-9_-]{8,64}$' or coalesce(v_session, '') !~ '^[A-Za-z0-9_-]{8,64}$' then
    return;
  end if;
  if jsonb_typeof(p_events) is distinct from 'array' or jsonb_array_length(p_events) not between 1 and 50 then
    return;
  end if;

  v_ip := trim(coalesce(
    v_headers->>'cf-connecting-ip',
    split_part(v_headers->>'x-forwarded-for', ',', 1),
    v_headers->>'x-real-ip'
  ));
  if coalesce(v_ip, '') !~ '^[0-9A-Fa-f:.]{3,45}$' then
    v_ip := null;
  end if;

  insert into public.analytics_events (
    visitor_id, session_id, type, name, path, referrer, utm_source, utm_medium, utm_campaign,
    device, browser, os, screen, language, timezone, country, region, city, ip,
    duration_s, scroll_pct, props
  )
  select
    v_visitor,
    v_session,
    ev->>'type',
    left(ev->>'name', 60),
    left(coalesce(ev->>'path', p_context->>'path'), 200),
    left(nullif(p_context->>'referrer', ''), 120),
    left(nullif(p_context->>'utm_source', ''), 80),
    left(nullif(p_context->>'utm_medium', ''), 80),
    left(nullif(p_context->>'utm_campaign', ''), 120),
    left(p_context->>'device', 20),
    left(p_context->>'browser', 40),
    left(p_context->>'os', 40),
    left(p_context->>'screen', 20),
    left(p_context->>'language', 20),
    left(p_context->>'timezone', 60),
    left(upper(p_context->>'country'), 2),
    left(p_context->>'region', 80),
    left(p_context->>'city', 80),
    v_ip,
    case when ev->>'duration_s' ~ '^\d{1,6}$' then least((ev->>'duration_s')::int, 86400) end,
    case when ev->>'scroll_pct' ~ '^\d{1,3}$' then least((ev->>'scroll_pct')::int, 100)::smallint end,
    case when jsonb_typeof(ev->'props') = 'object' and length((ev->'props')::text) <= 1000 then ev->'props' end
  from jsonb_array_elements(p_events) as ev
  where ev->>'type' in ('pageview', 'event', 'engagement');

  -- Housekeeping on ~1% of calls
  if random() < 0.01 then
    update public.analytics_events set ip = null where ip is not null and created_at < now() - interval '90 days';
    delete from public.analytics_events where created_at < now() - interval '13 months';
  end if;
end;
$$;

revoke all on function public.track_events(jsonb, jsonb) from public;
grant execute on function public.track_events(jsonb, jsonb) to anon, authenticated;


-- ─── Headline numbers for a period (used for current + previous period) ─────

create or replace function public.analytics_totals(p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with ev as (
    select * from public.analytics_events where created_at >= p_from and created_at < p_to
  ),
  s as (
    select
      session_id,
      coalesce(max(duration_s) filter (where type = 'engagement'), 0)        as duration_s,
      count(*) filter (where type = 'event' and name <> 'section_view')      as interactions,
      bool_or(type = 'event' and name = 'contact_submit')                    as converted
    from ev
    group by session_id
  )
  select jsonb_build_object(
    'pageviews',          (select count(*) from ev where type = 'pageview'),
    'visitors',           (select count(distinct visitor_id) from ev),
    'sessions',           (select count(*) from s),
    'new_visitors',       (select count(*) from (
                             select visitor_id from public.analytics_events
                             where visitor_id in (select visitor_id from ev)
                             group by visitor_id
                             having min(created_at) >= p_from
                           ) n),
    'avg_duration_s',     (select coalesce(round(avg(duration_s)), 0) from s),
    'engaged_sessions',   (select count(*) from s where duration_s >= 10 or interactions > 0),
    'converted_sessions', (select count(*) from s where converted),
    'enquiries',          (select count(*) from ev where type = 'event' and name = 'contact_submit'),
    'whatsapp_clicks',    (select count(*) from ev where type = 'event' and name = 'whatsapp_click'),
    'contact_clicks',     (select count(*) from ev where type = 'event' and name in ('whatsapp_click', 'email_click', 'phone_click'))
  );
$$;

revoke all on function public.analytics_totals(timestamptz, timestamptz) from public, anon, authenticated;


-- ─── Full report for the dashboard ──────────────────────────────────────────

create or replace function public.analytics_report(p_from timestamptz, p_to timestamptz, p_tz text default 'Africa/Windhoek')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz     text := p_tz;
  v_len    interval;
  v_bucket text;
  v_step   interval;
  v_result jsonb;
begin
  if not (select public.is_admin()) then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if p_to <= p_from or p_to - p_from > interval '400 days' then
    raise exception 'Invalid date range';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = v_tz) then
    v_tz := 'UTC';
  end if;

  v_len    := p_to - p_from;
  v_bucket := case when v_len <= interval '2 days' then 'hour' when v_len <= interval '120 days' then 'day' else 'month' end;
  v_step   := ('1 ' || v_bucket)::interval;

  with ev as (
    select * from public.analytics_events where created_at >= p_from and created_at < p_to
  ),
  ev_prev as (
    select created_at, type, name, visitor_id, session_id
    from public.analytics_events
    where created_at >= p_from - v_len and created_at < p_from
  ),
  sessions as (
    select
      session_id,
      (array_agg(visitor_id order by created_at))[1]                          as visitor_id,
      coalesce(max(duration_s) filter (where type = 'engagement'), 0)          as duration_s,
      (array_agg(coalesce(nullif(utm_source, ''), nullif(referrer, ''), 'Direct') order by created_at))[1] as source,
      (array_agg(utm_campaign order by created_at) filter (where utm_campaign is not null))[1]              as campaign,
      bool_or(type = 'event' and name = 'contact_submit')                      as converted
    from ev
    group by session_id
  ),
  first_seen as (
    select visitor_id, min(created_at) as first_at
    from public.analytics_events
    where visitor_id in (select distinct visitor_id from ev)
    group by visitor_id
  )
  select jsonb_build_object(
    'bucket',   v_bucket,
    'tz',       v_tz,
    'totals',   public.analytics_totals(p_from, p_to),
    'previous', public.analytics_totals(p_from - v_len, p_from),

    'series', (
      select coalesce(jsonb_agg(jsonb_build_object(
               't',         to_char(b.bucket, 'YYYY-MM-DD"T"HH24:MI'),
               'pageviews', coalesce(x.pageviews, 0),
               'visitors',  coalesce(x.visitors, 0),
               'sessions',  coalesce(x.sessions, 0),
               'enquiries', coalesce(x.enquiries, 0)
             ) order by b.bucket), '[]'::jsonb)
      from generate_series(
             date_trunc(v_bucket, p_from at time zone v_tz),
             date_trunc(v_bucket, (p_to - interval '1 second') at time zone v_tz),
             v_step) as b(bucket)
      left join (
        select date_trunc(v_bucket, created_at at time zone v_tz) as bucket,
               count(*) filter (where type = 'pageview')                       as pageviews,
               count(distinct visitor_id)                                       as visitors,
               count(distinct session_id)                                       as sessions,
               count(*) filter (where type = 'event' and name = 'contact_submit') as enquiries
        from ev group by 1
      ) x on x.bucket = b.bucket
    ),

    'previous_series', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'pageviews', coalesce(x.pageviews, 0),
               'visitors',  coalesce(x.visitors, 0),
               'sessions',  coalesce(x.sessions, 0),
               'enquiries', coalesce(x.enquiries, 0)
             ) order by b.bucket), '[]'::jsonb)
      from generate_series(
             date_trunc(v_bucket, (p_from - v_len) at time zone v_tz),
             date_trunc(v_bucket, (p_from - interval '1 second') at time zone v_tz),
             v_step) as b(bucket)
      left join (
        select date_trunc(v_bucket, created_at at time zone v_tz) as bucket,
               count(*) filter (where type = 'pageview')                       as pageviews,
               count(distinct visitor_id)                                       as visitors,
               count(distinct session_id)                                       as sessions,
               count(*) filter (where type = 'event' and name = 'contact_submit') as enquiries
        from ev_prev group by 1
      ) x on x.bucket = b.bucket
    ),

    'sources', (
      select coalesce(jsonb_agg(jsonb_build_object('label', label, 'value', n, 'visitors', v) order by n desc), '[]'::jsonb)
      from (select source as label, count(*) as n, count(distinct visitor_id) as v
            from sessions group by source order by n desc limit 10) t
    ),
    'campaigns', (
      select coalesce(jsonb_agg(jsonb_build_object('label', label, 'value', n) order by n desc), '[]'::jsonb)
      from (select campaign as label, count(*) as n from sessions
            where campaign is not null group by campaign order by n desc limit 10) t
    ),
    'pages', (
      select coalesce(jsonb_agg(jsonb_build_object('label', label, 'value', n, 'visitors', v) order by n desc), '[]'::jsonb)
      from (select coalesce(path, '/') as label, count(*) as n, count(distinct visitor_id) as v
            from ev where type = 'pageview' group by 1 order by n desc limit 10) t
    ),
    'countries', (
      select coalesce(jsonb_agg(jsonb_build_object('label', label, 'value', n) order by n desc), '[]'::jsonb)
      from (select coalesce(country, '??') as label, count(distinct visitor_id) as n
            from ev group by 1 order by n desc limit 10) t
    ),
    'cities', (
      select coalesce(jsonb_agg(jsonb_build_object('label', label, 'country', country, 'value', n) order by n desc), '[]'::jsonb)
      from (select city as label, max(country) as country, count(distinct visitor_id) as n
            from ev where city is not null group by city order by n desc limit 10) t
    ),
    'devices', (
      select coalesce(jsonb_agg(jsonb_build_object('label', label, 'value', n) order by n desc), '[]'::jsonb)
      from (select coalesce(device, 'unknown') as label, count(distinct visitor_id) as n
            from ev group by 1 order by n desc) t
    ),
    'browsers', (
      select coalesce(jsonb_agg(jsonb_build_object('label', label, 'value', n) order by n desc), '[]'::jsonb)
      from (select coalesce(browser, 'Unknown') as label, count(distinct visitor_id) as n
            from ev group by 1 order by n desc limit 8) t
    ),
    'os', (
      select coalesce(jsonb_agg(jsonb_build_object('label', label, 'value', n) order by n desc), '[]'::jsonb)
      from (select coalesce(os, 'Unknown') as label, count(distinct visitor_id) as n
            from ev group by 1 order by n desc limit 8) t
    ),
    'sections', (
      select coalesce(jsonb_agg(jsonb_build_object('label', label, 'value', n)), '[]'::jsonb)
      from (select props->>'section' as label, count(distinct session_id) as n
            from ev where type = 'event' and name = 'section_view' and props ? 'section'
            group by 1) t
    ),
    'actions', (
      select coalesce(jsonb_agg(jsonb_build_object('label', label, 'value', n, 'visitors', v) order by n desc), '[]'::jsonb)
      from (select name as label, count(*) as n, count(distinct visitor_id) as v
            from ev where type = 'event' and name <> 'section_view'
            group by name order by n desc) t
    ),
    'interest', (
      select coalesce(jsonb_agg(jsonb_build_object('label', label, 'requests', r, 'enquiries', e) order by r + e desc), '[]'::jsonb)
      from (select props->>'service' as label,
                   count(*) filter (where name = 'service_request') as r,
                   count(*) filter (where name = 'contact_submit')  as e
            from ev
            where type = 'event' and name in ('service_request', 'contact_submit') and props ? 'service'
            group by 1 order by count(*) desc limit 12) t
    ),
    'heatmap', (
      select coalesce(jsonb_agg(jsonb_build_object('d', d, 'h', h, 'n', n)), '[]'::jsonb)
      from (select extract(isodow from created_at at time zone v_tz)::int as d,
                   extract(hour   from created_at at time zone v_tz)::int as h,
                   count(*) as n
            from ev where type = 'pageview' group by 1, 2) t
    ),
    'visitors', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.sessions desc, t.pageviews desc, t.last_seen desc), '[]'::jsonb)
      from (
        select
          e.visitor_id,
          count(distinct e.session_id)                                              as sessions,
          count(*) filter (where e.type = 'pageview')                               as pageviews,
          (select coalesce(sum(s.duration_s), 0) from sessions s where s.visitor_id = e.visitor_id) as duration_s,
          fs.first_at                                                               as first_seen,
          max(e.created_at)                                                         as last_seen,
          (array_agg(e.device  order by e.created_at desc))[1]                      as device,
          (array_agg(e.browser order by e.created_at desc))[1]                      as browser,
          (array_agg(e.os      order by e.created_at desc))[1]                      as os,
          (array_agg(e.country order by e.created_at desc))[1]                      as country,
          (array_agg(e.city    order by e.created_at desc))[1]                      as city,
          (array_agg(e.ip order by e.created_at desc) filter (where e.ip is not null))[1] as ip,
          bool_or(e.type = 'event' and e.name = 'contact_submit')                   as converted,
          count(*) filter (where e.type = 'event' and e.name in ('whatsapp_click', 'email_click', 'phone_click')) as contact_clicks
        from ev e
        join first_seen fs using (visitor_id)
        group by e.visitor_id, fs.first_at
        order by sessions desc, pageviews desc, last_seen desc
        limit 100
      ) t
    ),
    'active_now', (
      select count(distinct session_id) from public.analytics_events where created_at > now() - interval '3 minutes'
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.analytics_report(timestamptz, timestamptz, text) from public, anon;
grant execute on function public.analytics_report(timestamptz, timestamptz, text) to authenticated;


-- ─── One visitor's timeline ─────────────────────────────────────────────────

create or replace function public.analytics_visitor(p_visitor_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not (select public.is_admin()) then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'visitor_id', p_visitor_id,
    'first_seen', min(created_at),
    'last_seen',  max(created_at),
    'sessions',   count(distinct session_id),
    'pageviews',  count(*) filter (where type = 'pageview'),
    'ips',        coalesce((select jsonb_agg(distinct ip) from public.analytics_events where visitor_id = p_visitor_id and ip is not null), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
               't', x.created_at, 'session_id', x.session_id, 'type', x.type, 'name', x.name, 'path', x.path,
               'props', x.props, 'duration_s', x.duration_s, 'scroll_pct', x.scroll_pct,
               'device', x.device, 'browser', x.browser, 'os', x.os, 'screen', x.screen, 'language', x.language,
               'city', x.city, 'region', x.region, 'country', x.country, 'ip', x.ip,
               'source', coalesce(x.utm_source, x.referrer), 'campaign', x.utm_campaign
             ) order by x.created_at desc)
      from (select * from public.analytics_events where visitor_id = p_visitor_id order by created_at desc limit 500) x
    ), '[]'::jsonb)
  )
  into v_result
  from public.analytics_events
  where visitor_id = p_visitor_id;

  return v_result;
end;
$$;

revoke all on function public.analytics_visitor(text) from public, anon;
grant execute on function public.analytics_visitor(text) to authenticated;


-- ─── Live view ──────────────────────────────────────────────────────────────

create or replace function public.analytics_live()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'active', (select count(distinct session_id) from public.analytics_events where created_at > now() - interval '3 minutes'),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object(
               't', created_at, 'visitor_id', visitor_id, 'type', type, 'name', name, 'props', props,
               'device', device, 'city', city, 'country', country
             ) order by created_at desc)
      from (
        select * from public.analytics_events
        where created_at > now() - interval '30 minutes'
          and (type = 'pageview' or (type = 'event' and name <> 'section_view'))
        order by created_at desc
        limit 12
      ) r
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.analytics_live() from public, anon;
grant execute on function public.analytics_live() to authenticated;

commit;

select 'Analytics installed ✓' as status;
