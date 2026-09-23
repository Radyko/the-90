-- ═══════════════════════════════════════════════════════════════════════════
-- The 90 — database schema
--
-- Clans take on a challenge (75 Hard, 75 Soft, The 90, custom). Each member keeps a
-- flame alive by completing every task, every day, on their own local calendar.
-- Miss a day and the flame dies: back to Day 1, and the clan sees it.
--
-- Layout
--   public   tables (read via RLS) + the client-facing RPCs (the only write path)
--   private  game engine + RLS helpers. Not exposed by the Data API at all.
--
-- Security model
--   * RLS: you see only clans you belong to, and the people in them.
--   * No direct writes to game tables. Every change goes through an RPC that
--     validates it — e.g. tasks can only be checked for YOUR today, so nobody can
--     backfill yesterday to dodge a death.
--   * Deaths are judged by private.evaluate_member(): hourly via pg_cron (cron.sql)
--     and on demand via sync_me() when the app opens.
--
-- Run in the Supabase SQL editor. Idempotent: safe to re-run after edits.
-- ═══════════════════════════════════════════════════════════════════════════

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;  -- RLS helpers run as the caller

create or replace function private.new_invite_code()
returns text language sql volatile set search_path = '' as $$
  -- 16 hex chars = 64 bits: the secret inside an invite link.
  select substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
$$;


-- ═══ Tables ════════════════════════════════════════════════════════════════

create table if not exists public.profiles (
  id                  uuid        primary key references auth.users(id) on delete cascade,
  display_name        text        not null check (char_length(display_name) between 1 and 32),
  persona             jsonb       not null default '{}'::jsonb,   -- { hue, eyes, gear }
  timezone            text        not null default 'UTC' check (char_length(timezone) <= 64),
  timezone_changed_at timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.clans (
  id             uuid        primary key default gen_random_uuid(),
  name           text        not null check (char_length(name) between 2 and 40),
  challenge_name text        not null check (char_length(challenge_name) between 1 and 40),
  length_days    integer     not null check (length_days between 7 and 365),
  tasks          jsonb       not null,   -- [{ key, label, hint? }], validated by create_clan()
  invite_code    text        not null unique default private.new_invite_code(),
  is_public      boolean     not null default true,   -- listed on the global leaderboard
  max_members    integer     not null default 100 check (max_members between 2 and 500),
  created_by     uuid        references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);

create table if not exists public.clan_members (
  clan_id        uuid        not null references public.clans(id) on delete cascade,
  user_id        uuid        not null references auth.users(id) on delete cascade,
  role           text        not null default 'member' check (role in ('leader', 'member')),
  status         text        not null default 'pending' check (status in ('pending', 'active')),
  start_date     date        not null default current_date,  -- Day 1 of the current run (local)
  attempt        integer     not null default 1 check (attempt >= 1),
  deaths         integer     not null default 0 check (deaths >= 0),
  best_run       integer     not null default 0 check (best_run >= 0),
  -- { "YYYY-MM-DD": { "<task key>": true|false } }, keyed by the member's local date
  log            jsonb       not null default '{}'::jsonb
                             check (jsonb_typeof(log) = 'object' and pg_column_size(log) < 65536),
  finished_at    timestamptz,
  last_evaluated date,       -- latest local day already judged; every day up to it was complete
  requested_at   timestamptz not null default now(),
  joined_at      timestamptz,
  updated_at     timestamptz not null default now(),
  primary key (clan_id, user_id)
);

create index if not exists clan_members_user_idx on public.clan_members (user_id);

create table if not exists public.clan_events (
  id         bigint      generated always as identity primary key,
  clan_id    uuid        not null references public.clans(id) on delete cascade,
  user_id    uuid        references auth.users(id) on delete cascade,   -- the actor
  kind       text        not null,
  day        integer,
  meta       jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.clan_events drop constraint if exists clan_events_kind_check;
alter table public.clan_events add constraint clan_events_kind_check check (kind in (
  'joined',        -- day = 1
  'left',          -- meta.removed = true when a leader removed them
  'day_complete',  -- day = day number completed
  'milestone',     -- day = milestone day completed
  'died',          -- day = days survived, meta.attempt = attempt that ended
  'finished',      -- day = challenge length
  'stoke'          -- meta.target = user nudged
));

create index if not exists clan_events_clan_idx on public.clan_events (clan_id, created_at desc);


-- ═══ Pure helpers ══════════════════════════════════════════════════════════

create or replace function private.day_complete(p_log jsonb, p_day date, p_tasks jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select not exists (
    select 1 from jsonb_array_elements(p_tasks) t
    where coalesce((p_log -> p_day::text ->> (t ->> 'key'))::boolean, false) = false);
$$;

create or replace function private.tasks_done(p_log jsonb, p_day date, p_tasks jsonb)
returns integer language sql immutable set search_path = '' as $$
  select count(*)::integer from jsonb_array_elements(p_tasks) t
  where coalesce((p_log -> p_day::text ->> (t ->> 'key'))::boolean, false);
$$;

-- Flame stage from the share of the challenge completed in the current run.
create or replace function private.stage(p_completed integer, p_length integer, p_finished boolean)
returns text language sql immutable set search_path = '' as $$
  select case
    when p_finished then 'phoenix'
    when p_completed::numeric / p_length < 0.08 then 'spark'
    when p_completed::numeric / p_length < 0.25 then 'flame'
    when p_completed::numeric / p_length < 0.50 then 'blaze'
    when p_completed::numeric / p_length < 0.83 then 'inferno'
    else 'phoenix'
  end;
$$;

create or replace function private.validate_tasks(p_tasks jsonb)
returns void language plpgsql immutable set search_path = '' as $$
declare
  t jsonb;
begin
  if jsonb_typeof(p_tasks) is distinct from 'array'
     or jsonb_array_length(p_tasks) not between 1 and 10 then
    raise exception 'bad_tasks';
  end if;
  for t in select * from jsonb_array_elements(p_tasks) loop
    if coalesce(t ->> 'key', '') !~ '^[a-z0-9_]{1,24}$'
       or char_length(coalesce(t ->> 'label', '')) not between 1 and 60
       or char_length(coalesce(t ->> 'hint', '')) > 120 then
      raise exception 'bad_tasks';
    end if;
  end loop;
  if (select count(distinct x ->> 'key') from jsonb_array_elements(p_tasks) x)
     <> jsonb_array_length(p_tasks) then
    raise exception 'bad_tasks';
  end if;
end;
$$;


-- ═══ Lookups ═══════════════════════════════════════════════════════════════

create or replace function private.user_today(p_user uuid)
returns date language sql stable security definer set search_path = '' as $$
  select (now() at time zone coalesce(
    (select timezone from public.profiles where id = p_user), 'UTC'))::date;
$$;

-- Days survived in the current run, counting only days already judged complete.
create or replace function private.current_run(m public.clan_members)
returns integer language sql immutable set search_path = '' as $$
  select case when m.last_evaluated >= m.start_date
              then m.last_evaluated - m.start_date + 1 else 0 end;
$$;

-- Gear is earned: headband at a 7-day run, horns at 30, crown for finishing a challenge.
create or replace function private.unlocked_gear(p_user uuid)
returns text[] language sql stable security definer set search_path = '' as $$
  with s as (
    select coalesce(max(greatest(m.best_run, private.current_run(m))), 0) as best,
           bool_or(m.finished_at is not null) as finished
    from public.clan_members m where m.user_id = p_user)
  select array_remove(array[
    'none',
    case when s.best >= 7  then 'headband' end,
    case when s.best >= 30 then 'horns' end,
    case when s.finished  then 'crown' end], null)
  from s;
$$;

create or replace function private.is_clan_member(p_clan uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.clan_members
                 where clan_id = p_clan and user_id = auth.uid());
$$;

create or replace function private.is_active_member(p_clan uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.clan_members
                 where clan_id = p_clan and user_id = auth.uid() and status = 'active');
$$;

create or replace function private.shares_clan_with(p_other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.clan_members me
    join public.clan_members them on them.clan_id = me.clan_id
    where me.user_id = auth.uid() and me.status = 'active' and them.user_id = p_other);
$$;

create or replace function private.require_user()
returns uuid language plpgsql stable set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  return auth.uid();
end;
$$;

create or replace function private.require_leader(p_clan uuid)
returns uuid language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.clan_members
                 where clan_id = p_clan and user_id = auth.uid()
                   and role = 'leader' and status = 'active') then
    raise exception 'not_leader';
  end if;
  return auth.uid();
end;
$$;

create or replace function private.require_clan_slot(p_user uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'no_profile';
  end if;
  if (select count(*) from public.clan_members where user_id = p_user) >= 5 then
    raise exception 'too_many_clans';
  end if;
end;
$$;


-- ═══ Triggers ══════════════════════════════════════════════════════════════

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Guards on profile writes: valid persona, earned gear, honest time zones.
create or replace function private.guard_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_persona jsonb := new.persona;
begin
  if jsonb_typeof(v_persona) <> 'object'
     or (v_persona ? 'hue'  and (jsonb_typeof(v_persona -> 'hue') <> 'number'
                                 or (v_persona ->> 'hue')::numeric not between 0 and 359))
     or (v_persona ? 'eyes' and v_persona ->> 'eyes' not in ('round', 'sharp', 'sleepy', 'happy'))
     or (v_persona ? 'gear' and v_persona ->> 'gear' not in ('none', 'headband', 'horns', 'crown'))
     or (select count(*) from jsonb_object_keys(v_persona) k
         where k not in ('hue', 'eyes', 'gear')) > 0 then
    raise exception 'bad_persona';
  end if;

  if coalesce(v_persona ->> 'gear', 'none') <> 'none'
     and not (v_persona ->> 'gear') = any (private.unlocked_gear(new.id)) then
    raise exception 'gear_locked';
  end if;

  perform now() at time zone new.timezone;  -- raises on an unknown IANA zone

  if tg_op = 'UPDATE' and new.timezone is distinct from old.timezone then
    -- Moving clocks must not buy an extra day: at most one change per 12h, and every
    -- day that already ended under the old zone is judged before the switch.
    if old.timezone_changed_at > now() - interval '12 hours' then
      raise exception 'timezone_change_too_soon';
    end if;
    perform private.evaluate_member(m.clan_id, m.user_id)
      from public.clan_members m
     where m.user_id = new.id and m.status = 'active' and m.finished_at is null;
    new.timezone_changed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before insert or update on public.profiles
  for each row execute function private.guard_profile();

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

drop trigger if exists clan_members_touch on public.clan_members;
create trigger clan_members_touch before update on public.clan_members
  for each row execute function private.touch_updated_at();


-- ═══ Row-Level Security ════════════════════════════════════════════════════

alter table public.profiles     enable row level security;
alter table public.clans        enable row level security;
alter table public.clan_members enable row level security;
alter table public.clan_events  enable row level security;

drop policy if exists "profiles: self or clanmates" on public.profiles;
create policy "profiles: self or clanmates" on public.profiles
  for select to authenticated
  using (id = auth.uid() or private.shares_clan_with(id));

drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own" on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "clans: members read" on public.clans;
create policy "clans: members read" on public.clans
  for select to authenticated using (private.is_clan_member(id));

drop policy if exists "clan_members: clanmates read" on public.clan_members;
create policy "clan_members: clanmates read" on public.clan_members
  for select to authenticated
  using (user_id = auth.uid() or private.is_active_member(clan_id));

drop policy if exists "clan_events: clanmates read" on public.clan_events;
create policy "clan_events: clanmates read" on public.clan_events
  for select to authenticated using (private.is_active_member(clan_id));

revoke all on public.profiles, public.clans, public.clan_members, public.clan_events
  from anon, authenticated;
grant select on public.profiles, public.clans, public.clan_members, public.clan_events
  to authenticated;
grant insert (id, display_name, persona, timezone) on public.profiles to authenticated;
grant update (display_name, persona, timezone)     on public.profiles to authenticated;
-- clans / clan_members / clan_events: no direct writes. RPCs only.


-- ═══ Game engine (private) ═════════════════════════════════════════════════

create or replace function private.log_event(
  p_clan uuid, p_user uuid, p_kind text, p_day integer default null, p_meta jsonb default '{}')
returns void language sql security definer set search_path = '' as $$
  insert into public.clan_events (clan_id, user_id, kind, day, meta)
  values (p_clan, p_user, p_kind, p_day, p_meta);
$$;

-- The flame dies: record it and restart the run at Day 1 on p_today.
create or replace function private.kill_member(p_clan uuid, p_user uuid, p_survived integer, p_today date)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_ended integer;
begin
  update public.clan_members
     set deaths         = deaths + 1,
         attempt        = attempt + 1,
         best_run       = greatest(best_run, p_survived),
         start_date     = p_today,
         last_evaluated = p_today - 1,
         -- drop today's boxes and anything older than ~13 months
         log = (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
                  from jsonb_each(log) as e(k, v)
                 where k < p_today::text and k >= (p_today - 400)::text)
   where clan_id = p_clan and user_id = p_user
   returning attempt - 1 into v_ended;

  perform private.log_event(p_clan, p_user, 'died', p_survived,
                            jsonb_build_object('attempt', v_ended));
end;
$$;

-- Judge every local day that has ended since the last evaluation. Idempotent.
create or replace function private.evaluate_member(p_clan uuid, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  m       public.clan_members;
  v_tasks jsonb;
  v_today date := private.user_today(p_user);
  v_day   date;
begin
  select * into m from public.clan_members
   where clan_id = p_clan and user_id = p_user
     and status = 'active' and finished_at is null
     for update;
  if not found then return; end if;
  select tasks into v_tasks from public.clans where id = p_clan;

  v_day := greatest(m.start_date, coalesce(m.last_evaluated + 1, m.start_date));
  while v_day < v_today loop
    if not private.day_complete(m.log, v_day, v_tasks) then
      perform private.kill_member(p_clan, p_user, v_day - m.start_date, v_today);
      return;
    end if;
    v_day := v_day + 1;
  end loop;

  if v_today - 1 >= m.start_date and m.last_evaluated is distinct from v_today - 1 then
    update public.clan_members set last_evaluated = v_today - 1
     where clan_id = p_clan and user_id = p_user;
  end if;
end;
$$;

-- pg_cron entry point (cron.sql).
create or replace function private.evaluate_all()
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.evaluate_member(clan_id, user_id)
     from public.clan_members
    where status = 'active' and finished_at is null;
end;
$$;

-- Remove a membership, keeping the clan consistent (new leader / delete empty clan).
create or replace function private.remove_membership(p_clan uuid, p_user uuid, p_removed boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_role   text;
  v_status text;
begin
  delete from public.clan_members where clan_id = p_clan and user_id = p_user
  returning role, status into v_role, v_status;
  if not found then return; end if;

  if not exists (select 1 from public.clan_members where clan_id = p_clan and status = 'active') then
    delete from public.clans where id = p_clan;  -- last one out closes the clan
    return;
  end if;

  if v_status = 'active' then
    perform private.log_event(p_clan, p_user, 'left', null,
                              case when p_removed then '{"removed": true}'::jsonb else '{}' end);
  end if;

  if v_role = 'leader' then
    update public.clan_members set role = 'leader'
     where (clan_id, user_id) = (
       select clan_id, user_id from public.clan_members
        where clan_id = p_clan and status = 'active'
        order by joined_at, user_id limit 1);
  end if;
end;
$$;


-- ═══ RPCs: playing ═════════════════════════════════════════════════════════

-- Call on app open: judge my ended days right now.
create or replace function public.sync_me()
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.evaluate_member(clan_id, user_id)
     from public.clan_members
    where user_id = private.require_user() and status = 'active' and finished_at is null;
end;
$$;

-- Check / uncheck one task for MY today. The only way to write a log.
create or replace function public.check_task(p_clan uuid, p_key text, p_done boolean)
returns public.clan_members language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := private.require_user();
  v_today date := private.user_today(auth.uid());
  c       public.clans;
  m       public.clan_members;
  v_was   boolean;
  v_dayno integer;
begin
  perform private.evaluate_member(p_clan, v_uid);  -- settle any death first

  select * into c from public.clans where id = p_clan;
  select * into m from public.clan_members
   where clan_id = p_clan and user_id = v_uid and status = 'active' for update;
  if not found then raise exception 'not_a_member'; end if;
  if m.finished_at is not null then raise exception 'already_finished'; end if;
  if not exists (select 1 from jsonb_array_elements(c.tasks) t where t ->> 'key' = p_key) then
    raise exception 'unknown_task';
  end if;

  v_was := private.day_complete(m.log, v_today, c.tasks);
  update public.clan_members
     set log = log || jsonb_build_object(v_today::text,
                 coalesce(log -> v_today::text, '{}'::jsonb) || jsonb_build_object(p_key, p_done))
   where clan_id = p_clan and user_id = v_uid
   returning * into m;

  v_dayno := v_today - m.start_date + 1;
  if private.day_complete(m.log, v_today, c.tasks) and not v_was then
    if v_dayno >= c.length_days then
      update public.clan_members
         set finished_at = now(), best_run = greatest(best_run, c.length_days)
       where clan_id = p_clan and user_id = v_uid
       returning * into m;
      perform private.log_event(p_clan, v_uid, 'finished', c.length_days,
                                jsonb_build_object('attempt', m.attempt));
    -- Announce each day once per attempt, even if boxes are unchecked and rechecked.
    elsif not exists (select 1 from public.clan_events
                       where clan_id = p_clan and user_id = v_uid and day = v_dayno
                         and kind in ('day_complete', 'milestone')
                         and (meta ->> 'attempt')::integer = m.attempt) then
      perform private.log_event(
        p_clan, v_uid,
        case when v_dayno in (7, 14, 21, 30, 45, 50, 60, 75, 100, 150, 200, 300)
             then 'milestone' else 'day_complete' end,
        v_dayno, jsonb_build_object('attempt', m.attempt));
    end if;
  end if;

  return m;
end;
$$;

-- Honest self-report ("I broke a rule today"): the flame dies now.
create or replace function public.self_report_fail(p_clan uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := private.require_user();
  v_today date := private.user_today(auth.uid());
  m       public.clan_members;
begin
  perform private.evaluate_member(p_clan, v_uid);
  select * into m from public.clan_members
   where clan_id = p_clan and user_id = v_uid and status = 'active' for update;
  if not found then raise exception 'not_a_member'; end if;
  if m.finished_at is not null then raise exception 'already_finished'; end if;
  perform private.kill_member(p_clan, v_uid, v_today - m.start_date, v_today);
end;
$$;

-- Nudge a clanmate who hasn't finished today. Once per target per 20h.
create or replace function public.stoke(p_clan uuid, p_target uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := private.require_user();
  v_tasks jsonb;
  t       public.clan_members;
begin
  if p_target = v_uid then raise exception 'cannot_stoke_self'; end if;
  if not private.is_active_member(p_clan) then raise exception 'not_a_member'; end if;
  select * into t from public.clan_members
   where clan_id = p_clan and user_id = p_target and status = 'active' and finished_at is null;
  if not found then raise exception 'not_a_member'; end if;

  select tasks into v_tasks from public.clans where id = p_clan;
  if private.day_complete(t.log, private.user_today(p_target), v_tasks) then
    raise exception 'already_done_today';
  end if;
  if exists (select 1 from public.clan_events
             where clan_id = p_clan and kind = 'stoke' and user_id = v_uid
               and meta ->> 'target' = p_target::text
               and created_at > now() - interval '20 hours') then
    raise exception 'already_stoked';
  end if;

  perform private.log_event(p_clan, v_uid, 'stoke', null,
                            jsonb_build_object('target', p_target));
end;
$$;


-- ═══ RPCs: clans ═══════════════════════════════════════════════════════════

create or replace function public.create_clan(
  p_name text, p_challenge_name text, p_length_days integer, p_tasks jsonb,
  p_is_public boolean default true)
returns public.clans language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := private.require_user();
  v_clan public.clans;
begin
  perform private.require_clan_slot(v_uid);
  perform private.validate_tasks(p_tasks);

  insert into public.clans (name, challenge_name, length_days, tasks, is_public, created_by)
  values (trim(p_name), trim(p_challenge_name), p_length_days, p_tasks,
          coalesce(p_is_public, true), v_uid)
  returning * into v_clan;

  insert into public.clan_members (clan_id, user_id, role, status, start_date, joined_at)
  values (v_clan.id, v_uid, 'leader', 'active', private.user_today(v_uid), now());

  perform private.log_event(v_clan.id, v_uid, 'joined', 1);
  return v_clan;
end;
$$;

-- What an invite link shows before joining. No member identities.
create or replace function public.preview_clan(p_code text)
returns table (id uuid, name text, challenge_name text, length_days integer,
               tasks jsonb, members bigint, my_status text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, c.challenge_name, c.length_days, c.tasks,
         (select count(*) from public.clan_members m where m.clan_id = c.id and m.status = 'active'),
         (select m.status from public.clan_members m where m.clan_id = c.id and m.user_id = auth.uid())
    from public.clans c
   where c.invite_code = p_code and auth.uid() is not null;
$$;

create or replace function public.request_join(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := private.require_user();
  v_clan public.clans;
begin
  select * into v_clan from public.clans where invite_code = p_code for update;
  if not found then raise exception 'invalid_invite'; end if;
  if exists (select 1 from public.clan_members where clan_id = v_clan.id and user_id = v_uid) then
    return v_clan.id;
  end if;
  perform private.require_clan_slot(v_uid);
  if (select count(*) from public.clan_members where clan_id = v_clan.id) >= v_clan.max_members then
    raise exception 'clan_full';
  end if;

  insert into public.clan_members (clan_id, user_id, role, status)
  values (v_clan.id, v_uid, 'member', 'pending');
  return v_clan.id;
end;
$$;

-- Leader approves (the member starts Day 1 in their own today) or rejects.
create or replace function public.respond_request(p_clan uuid, p_user uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_leader(p_clan);
  if p_accept then
    update public.clan_members
       set status = 'active', start_date = private.user_today(p_user), joined_at = now()
     where clan_id = p_clan and user_id = p_user and status = 'pending';
    if found then
      perform private.log_event(p_clan, p_user, 'joined', 1);
    end if;
  else
    delete from public.clan_members
     where clan_id = p_clan and user_id = p_user and status = 'pending';
  end if;
end;
$$;

create or replace function public.leave_clan(p_clan uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.remove_membership(p_clan, private.require_user(), false);
end;
$$;


-- ═══ RPCs: leader tools ════════════════════════════════════════════════════
-- The challenge itself (tasks, length) is fixed once a clan exists — fair for everyone.

create or replace function public.update_clan(p_clan uuid, p_name text, p_is_public boolean)
returns public.clans language plpgsql security definer set search_path = '' as $$
declare
  v_clan public.clans;
begin
  perform private.require_leader(p_clan);
  update public.clans
     set name = coalesce(nullif(trim(p_name), ''), name),
         is_public = coalesce(p_is_public, is_public)
   where id = p_clan
   returning * into v_clan;
  return v_clan;
end;
$$;

-- Invalidate a leaked invite link.
create or replace function public.rotate_invite(p_clan uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_code text;
begin
  perform private.require_leader(p_clan);
  update public.clans set invite_code = private.new_invite_code()
   where id = p_clan returning invite_code into v_code;
  return v_code;
end;
$$;

create or replace function public.remove_member(p_clan uuid, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_user = private.require_leader(p_clan) then raise exception 'use_leave_clan'; end if;
  perform private.remove_membership(p_clan, p_user, true);
end;
$$;

create or replace function public.transfer_leadership(p_clan uuid, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_leader(p_clan);
begin
  update public.clan_members set role = 'leader'
   where clan_id = p_clan and user_id = p_user and status = 'active';
  if not found then raise exception 'not_a_member'; end if;
  update public.clan_members set role = 'member'
   where clan_id = p_clan and user_id = v_uid;
end;
$$;


-- ═══ RPCs: read models ═════════════════════════════════════════════════════
-- Derived state computed in ONE place, so every client shows the same numbers.

-- The clan's scoreboard. Pending requests are included for the leader only.
create or replace function public.clan_board(p_clan uuid)
returns table (
  user_id uuid, display_name text, persona jsonb, role text, status text,
  day integer, length_days integer, tasks_done integer, tasks_total integer,
  done_today boolean, stage text, attempt integer, deaths integer, best_run integer,
  finished boolean, today date)
language sql stable security definer set search_path = '' as $$
  with me as (
    select role, status from public.clan_members
     where clan_id = p_clan and user_id = auth.uid()),
  board as (
    select m.*, p.display_name, p.persona, c.length_days as len, c.tasks,
           private.user_today(m.user_id) as t
      from public.clan_members m
      join public.clans c on c.id = m.clan_id
      left join public.profiles p on p.id = m.user_id
     where m.clan_id = p_clan
       and (m.status = 'active' or (select role from me) = 'leader'))
  select r.user_id, r.display_name, r.persona, r.role, r.status,
         case when r.finished_at is not null then r.len
              else least(r.len, greatest(1, r.t - r.start_date + 1)) end,
         r.len,
         private.tasks_done(r.log, r.t, r.tasks),
         jsonb_array_length(r.tasks),
         private.day_complete(r.log, r.t, r.tasks),
         private.stage(greatest(0, r.t - r.start_date)
                         + case when private.day_complete(r.log, r.t, r.tasks) then 1 else 0 end,
                       r.len, r.finished_at is not null),
         r.attempt, r.deaths, r.best_run, r.finished_at is not null, r.t
    from board r
   where (select status from me) = 'active'
   order by (r.status = 'active') desc, (r.finished_at is not null) desc,
            (r.t - r.start_date) desc, r.display_name;
$$;

-- Everything the "Me" screen needs.
create or replace function public.my_stats()
returns table (best_run integer, deaths integer, finished integer, clans integer,
               unlocked_gear text[])
language sql stable security definer set search_path = '' as $$
  select coalesce(max(greatest(m.best_run, private.current_run(m))), 0)::integer,
         coalesce(sum(m.deaths), 0)::integer,
         count(*) filter (where m.finished_at is not null)::integer,
         count(*) filter (where m.status = 'active')::integer,
         private.unlocked_gear(auth.uid())
    from public.clan_members m
   where m.user_id = auth.uid() and auth.uid() is not null;
$$;

-- Clans vs clans. Aggregates only — never member identities.
-- Score = average current run across active members; needs 2+ members.
create or replace function public.clan_leaderboard(p_limit integer default 50)
returns table (clan_id uuid, name text, challenge_name text, members bigint,
               alive_today bigint, avg_run numeric, is_mine boolean)
language sql stable security definer set search_path = '' as $$
  with runs as (
    select m.clan_id, m.user_id,
           case when m.finished_at is not null then c.length_days
                else least(c.length_days, private.user_today(m.user_id) - m.start_date + 1)
           end as run,
           private.day_complete(m.log, private.user_today(m.user_id), c.tasks) as done_today
      from public.clan_members m
      join public.clans c on c.id = m.clan_id
     where m.status = 'active' and c.is_public)
  select c.id, c.name, c.challenge_name, count(*),
         count(*) filter (where r.done_today),
         round(avg(r.run), 1),
         bool_or(r.user_id = auth.uid())
    from runs r join public.clans c on c.id = r.clan_id
   where auth.uid() is not null
   group by c.id, c.name, c.challenge_name
  having count(*) >= 2
   order by avg(r.run) desc, count(*) desc, c.name
   limit least(greatest(p_limit, 1), 100);
$$;


-- ═══ RPCs: account ═════════════════════════════════════════════════════════

-- GDPR: leave every clan cleanly (leader handoff), then delete the auth user;
-- the rest cascades.
create or replace function public.delete_account()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := private.require_user();
  v_clan uuid;
begin
  for v_clan in select clan_id from public.clan_members where user_id = v_uid loop
    perform private.remove_membership(v_clan, v_uid, false);
  end loop;
  delete from auth.users where id = v_uid;
end;
$$;


-- ═══ Function privileges ═══════════════════════════════════════════════════
-- Supabase grants EXECUTE to anon/authenticated by default: revoke everything, then
-- grant back exactly the client API. private.* is also unreachable over the Data API.

revoke all on all functions in schema public  from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

grant execute on function
  public.sync_me(),
  public.check_task(uuid, text, boolean),
  public.self_report_fail(uuid),
  public.stoke(uuid, uuid),
  public.create_clan(text, text, integer, jsonb, boolean),
  public.preview_clan(text),
  public.request_join(text),
  public.respond_request(uuid, uuid, boolean),
  public.leave_clan(uuid),
  public.update_clan(uuid, text, boolean),
  public.rotate_invite(uuid),
  public.remove_member(uuid, uuid),
  public.transfer_leadership(uuid, uuid),
  public.clan_board(uuid),
  public.my_stats(),
  public.clan_leaderboard(integer),
  public.delete_account()
to authenticated;

-- RLS policies evaluate these as the querying user.
grant execute on function
  private.is_clan_member(uuid),
  private.is_active_member(uuid),
  private.shares_clan_with(uuid)
to authenticated;

-- Everything else in private.* runs only inside SECURITY DEFINER functions or
-- triggers (as the owner), so clients get no EXECUTE on it.


-- ═══ Realtime ══════════════════════════════════════════════════════════════
-- postgres_changes respects the SELECT policies above.

do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'clan_members', 'clan_events'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
