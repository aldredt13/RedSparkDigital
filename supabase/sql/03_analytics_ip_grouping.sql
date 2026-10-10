-- ════════════════════════════════════════════════════════════════════════════
-- RedSparkDigital — analytics: group by IP + filter bots       (site v2.3.0)
--
-- Run in: Supabase Dashboard → SQL Editor → paste all → Run.
-- Requires 01 and 02. Runs in one transaction; safe to run more than once.
--
-- What it changes
--   • Records the visitor's network/ISP name (e.g. "Paratus Telecommunications",
--     "Amazon.com, Inc.") so traffic from cloud servers, crawlers, link scanners
--     and VPN hosts can be recognised as bots.
--   • analytics_is_bot()   — the bot rule (network name, or data-centre towns for
--                            visits recorded before the network was captured)
--   • analytics_report()   — new p_hide_bots flag (default on); new "ips" list that
--                            groups visits per IP with devices used; "bots" count
--   • analytics_ip()       — one IP's full timeline
--   • analytics_set_networks() — lets the dashboard label older visits' networks
--   • analytics_live()     — hides bots by default
--   • analytics_excluded_ips + analytics_exclude_ip() / analytics_my_ip() — IPs that are
--                            never recorded (e.g. your own home/office connection)
-- ════════════════════════════════════════════════════════════════════════════

begin;

do $$
begin
  if to_regclass('public.analytics_events') is null or to_regprocedure('public.is_admin()') is null then
    raise exception 'Run 01_security_and_notifications.sql and 02_analytics.sql first.';
  end if;
end $$;

alter table public.analytics_events add column if not exists network text;
create index if not exists analytics_events_ip_idx on public.analytics_events (ip);


-- ─── Excluded IPs (e.g. the owner's home/office) — never recorded ───────────

create table if not exists public.analytics_excluded_ips (
  ip         text primary key,
  label      text,
  created_at timestamptz not null default now()
);

alter table public.analytics_excluded_ips enable row level security;

drop policy if exists analytics_excluded_ips_admin on public.analytics_excluded_ips;
create policy analytics_excluded_ips_admin on public.analytics_excluded_ips
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.analytics_excluded_ips from anon;

-- The IP address the database sees for the current request (used for "Exclude my IP")
create or replace function public.analytics_my_ip()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_headers jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
begin
  if not (select public.is_admin()) then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  return trim(coalesce(
    v_headers->>'cf-connecting-ip',
    split_part(v_headers->>'x-forwarded-for', ',', 1),
    v_headers->>'x-real-ip'
  ));
end;
$$;

revoke all on function public.analytics_my_ip() from public, anon;
grant execute on function public.analytics_my_ip() to authenticated;

-- Exclude an IP from now on and delete everything already recorded from it
create or replace function public.analytics_exclude_ip(p_ip text, p_label text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  if not (select public.is_admin()) then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if coalesce(trim(p_ip), '') !~ '^[0-9A-Fa-f:.]{3,45}$' then
    raise exception 'That doesn''t look like an IP address';
  end if;

  insert into public.analytics_excluded_ips (ip, label)
  values (trim(p_ip), left(nullif(trim(p_label), ''), 80))
  on conflict (ip) do update set label = coalesce(excluded.label, public.analytics_excluded_ips.label);

  delete from public.analytics_events where ip = trim(p_ip);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.analytics_exclude_ip(text, text) from public, anon;
grant execute on function public.analytics_exclude_ip(text, text) to authenticated;


-- ─── Bot rule ───────────────────────────────────────────────────────────────
-- Cloud, hosting and VPN-host networks — real visitors browse from ISPs and
-- mobile networks. Cloudflare, Fastly and plain Akamai are deliberately NOT
-- listed: Apple iCloud Private Relay and Cloudflare WARP route real people
-- through them. For rows recorded before network capture (network is null),
-- fall back to well-known US data-centre towns.

create or replace function public.analytics_is_bot(p_network text, p_city text, p_country text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    coalesce(p_network, '') ~* (
      'amazon|\maws\M|google(?!.?fiber)|microsoft|azure|digitalocean|\movh|hetzner|linode|akamai connected cloud|'
      || 'oracle|alibaba|tencent|huawei|contabo|vultr|choopa|leaseweb|scaleway|m247|datacamp|colocrossing|psychz|'
      || 'quadranet|hivelocity|zscaler|facebook|meta platforms|censys|shodan|hostroyale|ionos|godaddy|hostinger|netcup|'
      || 'upcloud|kamatera|packethub|tzulo|cdn77|g-core|gcore|servers\.com|hostwinds|interserver|liquid web|rackspace|'
      || 'ipxo|clouvider|performive|latitude\.sh|hosting|datacenter|data center'
    )
    or (
      nullif(p_network, '') is null
      and p_country = 'US'
      and p_city in ('Boardman', 'Ashburn', 'Council Bluffs', 'The Dalles', 'Quincy', 'Moses Lake',
                     'Prineville', 'Forest City', 'Altoona', 'Lenoir', 'Pryor', 'Moncks Corner', 'Papillion')
    );
$$;

grant execute on function public.analytics_is_bot(text, text, text) to authenticated;


-- ─── Collector: also store the network name ─────────────────────────────────

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

  -- Excluded IPs (the owner's own connections) are never recorded
  if v_ip is not null and exists (select 1 from public.analytics_excluded_ips where ip = v_ip) then
    return;
  end if;

  insert into public.analytics_events (
    visitor_id, session_id, type, name, path, referrer, utm_source, utm_medium, utm_campaign,
    device, browser, os, screen, language, timezone, country, region, city, network, ip,
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
    left(nullif(p_context->>'network', ''), 80),
    v_ip,
    case when ev->>'duration_s' ~ '^\d{1,6}$' then least((ev->>'duration_s')::int, 86400) end,
    case when ev->>'scroll_pct' ~ '^\d{1,3}$' then least((ev->>'scroll_pct')::int, 100)::smallint end,
    case when jsonb_typeof(ev->'props') = 'object' and length((ev->'props')::text) <= 1000 then ev->'props' end
  from jsonb_array_elements(p_events) as ev
  where ev->>'type' in ('pageview', 'event', 'engagement');

  if random() < 0.01 then
    update public.analytics_events set ip = null where ip is not null and created_at < now() - interval '90 days';
    delete from public.analytics_events where created_at < now() - interval '13 months';
  end if;
end;
$$;

revoke all on function public.track_events(jsonb, jsonb) from public;
grant execute on function public.track_events(jsonb, jsonb) to anon, authenticated;


-- ─── Headline numbers (now bot-aware) ───────────────────────────────────────

drop function if exists public.analytics_totals(timestamptz, timestamptz);

create or replace function public.analytics_totals(p_from timestamptz, p_to timestamptz, p_hide_bots boolean default true)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with ev as (
    select * from public.analytics_events
    where created_at >= p_from and created_at < p_to
      and (not p_hide_bots or not public.analytics_is_bot(network, city, country))
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
    'ips',                (select count(distinct coalesce(ip, 'id:' || visitor_id)) from ev),
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

revoke all on function public.analytics_totals(timestamptz, timestamptz, boolean) from public, anon, authenticated;


-- ─── Report ─────────────────────────────────────────────────────────────────

drop function if exists public.analytics_report(timestamptz, timestamptz, text);

create or replace function public.analytics_report(
  p_from timestamptz,
  p_to timestamptz,
  p_tz text default 'Africa/Windhoek',
  p_hide_bots boolean default true
)
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
    select * from public.analytics_events
    where created_at >= p_from and created_at < p_to
      and (not p_hide_bots or not public.analytics_is_bot(network, city, country))
  ),
  ev_prev as (
    select created_at, type, name, visitor_id, session_id
    from public.analytics_events
    where created_at >= p_from - v_len and created_at < p_from
      and (not p_hide_bots or not public.analytics_is_bot(network, city, country))
  ),
  ipev as (
    select ev.*, coalesce(ev.ip, 'id:' || ev.visitor_id) as ip_key from ev
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
    'bucket',    v_bucket,
    'tz',        v_tz,
    'hide_bots', p_hide_bots,
    'totals',    public.analytics_totals(p_from, p_to, p_hide_bots),
    'previous',  public.analytics_totals(p_from - v_len, p_from, p_hide_bots),
    'bots', (
      select count(distinct session_id) from public.analytics_events
      where created_at >= p_from and created_at < p_to
        and public.analytics_is_bot(network, city, country)
    ),

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
               count(*) filter (where type = 'pageview')                         as pageviews,
               count(distinct visitor_id)                                         as visitors,
               count(distinct session_id)                                         as sessions,
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
               count(*) filter (where type = 'pageview')                         as pageviews,
               count(distinct visitor_id)                                         as visitors,
               count(distinct session_id)                                         as sessions,
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
    'networks', (
      select coalesce(jsonb_agg(jsonb_build_object('label', label, 'value', n) order by n desc), '[]'::jsonb)
      from (select network as label, count(distinct coalesce(ip, 'id:' || visitor_id)) as n
            from ev where nullif(network, '') is not null group by network order by n desc limit 10) t
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

    -- One row per IP address (visits recorded without an IP fall back to the browser ID)
    'ips', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.visits desc, t.pageviews desc, t.last_seen desc), '[]'::jsonb)
      from (
        select
          g.ip_key                                                                   as key,
          max(g.ip)                                                                  as ip,
          (array_agg(g.network order by g.created_at desc) filter (where g.network is not null))[1] as network,
          count(distinct g.session_id)                                               as visits,
          count(*) filter (where g.type = 'pageview')                                as pageviews,
          count(distinct g.visitor_id)                                               as browsers,
          (select coalesce(sum(s.duration_s), 0) from sessions s
            where s.session_id in (select distinct x.session_id from ipev x where x.ip_key = g.ip_key)) as duration_s,
          min(g.created_at)                                                          as first_seen,
          max(g.created_at)                                                          as last_seen,
          (array_agg(g.city    order by g.created_at desc) filter (where g.city is not null))[1]    as city,
          (array_agg(g.country order by g.created_at desc) filter (where g.country is not null))[1] as country,
          (array_agg(g.visitor_id order by g.created_at desc))[1]                    as latest_visitor_id,
          bool_or(g.type = 'event' and g.name = 'contact_submit')                    as converted,
          count(*) filter (where g.type = 'event' and g.name in ('whatsapp_click', 'email_click', 'phone_click')) as contact_clicks,
          bool_or(public.analytics_is_bot(g.network, g.city, g.country))             as is_bot,
          (select jsonb_agg(jsonb_build_object('device', d.device, 'browser', d.browser, 'os', d.os, 'visits', d.n) order by d.n desc)
             from (select x.device, x.browser, x.os, count(distinct x.session_id) as n
                   from ipev x where x.ip_key = g.ip_key group by 1, 2, 3) d)          as devices
        from ipev g
        group by g.ip_key
        order by visits desc, pageviews desc, last_seen desc
        limit 150
      ) t
    ),

    -- Kept for dashboards older than v2.3.0
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
      select count(distinct session_id) from public.analytics_events
      where created_at > now() - interval '3 minutes'
        and (not p_hide_bots or not public.analytics_is_bot(network, city, country))
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.analytics_report(timestamptz, timestamptz, text, boolean) from public, anon;
grant execute on function public.analytics_report(timestamptz, timestamptz, text, boolean) to authenticated;


-- ─── One IP's timeline ──────────────────────────────────────────────────────

create or replace function public.analytics_ip(p_ip text)
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
    'ip',         p_ip,
    'network',    (array_agg(network order by created_at desc) filter (where network is not null))[1],
    'is_bot',     bool_or(public.analytics_is_bot(network, city, country)),
    'first_seen', min(created_at),
    'last_seen',  max(created_at),
    'sessions',   count(distinct session_id),
    'browsers',   count(distinct visitor_id),
    'pageviews',  count(*) filter (where type = 'pageview'),
    'ips',        jsonb_build_array(p_ip),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
               't', x.created_at, 'session_id', x.session_id, 'visitor_id', x.visitor_id, 'type', x.type, 'name', x.name,
               'path', x.path, 'props', x.props, 'duration_s', x.duration_s, 'scroll_pct', x.scroll_pct,
               'device', x.device, 'browser', x.browser, 'os', x.os, 'screen', x.screen, 'language', x.language,
               'city', x.city, 'region', x.region, 'country', x.country, 'ip', x.ip, 'network', x.network,
               'source', coalesce(x.utm_source, x.referrer), 'campaign', x.utm_campaign
             ) order by x.created_at desc)
      from (select * from public.analytics_events where ip = p_ip order by created_at desc limit 800) x
    ), '[]'::jsonb)
  )
  into v_result
  from public.analytics_events
  where ip = p_ip;

  return v_result;
end;
$$;

revoke all on function public.analytics_ip(text) from public, anon;
grant execute on function public.analytics_ip(text) to authenticated;


-- ─── Label networks for older visits (called by the dashboard) ──────────────

create or replace function public.analytics_set_networks(p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not (select public.is_admin()) then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 200 then
    raise exception 'Expected an array of up to 200 items';
  end if;

  -- An empty string marks "looked up, unknown" so the dashboard doesn't ask again
  update public.analytics_events e
  set network = coalesce(left(nullif(i->>'network', ''), 80), '')
  from jsonb_array_elements(p_items) as i
  where e.ip = i->>'ip' and e.network is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.analytics_set_networks(jsonb) from public, anon;
grant execute on function public.analytics_set_networks(jsonb) to authenticated;


-- ─── Live view (bots hidden by default) ─────────────────────────────────────

drop function if exists public.analytics_live();

create or replace function public.analytics_live(p_hide_bots boolean default true)
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
    'active', (
      select count(distinct session_id) from public.analytics_events
      where created_at > now() - interval '3 minutes'
        and (not p_hide_bots or not public.analytics_is_bot(network, city, country))
    ),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object(
               't', created_at, 'visitor_id', visitor_id, 'ip', ip, 'type', type, 'name', name, 'props', props,
               'device', device, 'city', city, 'country', country
             ) order by created_at desc)
      from (
        select * from public.analytics_events
        where created_at > now() - interval '30 minutes'
          and (type = 'pageview' or (type = 'event' and name <> 'section_view'))
          and (not p_hide_bots or not public.analytics_is_bot(network, city, country))
        order by created_at desc
        limit 12
      ) r
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.analytics_live(boolean) from public, anon;
grant execute on function public.analytics_live(boolean) to authenticated;

commit;

select 'Analytics IP grouping + bot filter installed ✓' as status;
