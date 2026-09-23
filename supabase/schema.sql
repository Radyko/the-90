-- ═══════════════════════════════════════════════════════════════════════════
-- The 90 — Supabase schema
--
-- Multi-tenant from day one: any number of people can sign up, and each PAIR
-- shares a private "board". Row-Level Security is the entire security model:
--   * you can only SEE boards you belong to, and the participants on them;
--   * you can only WRITE your own participant row, and only its progress columns;
--   * you can only JOIN a board through join_board(), which requires its invite
--     code and enforces the member cap.
--
-- Run this whole file once in the Supabase SQL editor. It is idempotent enough to
-- re-run during development (drops/recreates policies, functions, triggers).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Tables ────────────────────────────────────────────────────────────────

create table if not exists public.boards (
  id           uuid        primary key default gen_random_uuid(),
  name         text        check (name is null or char_length(name) <= 60),
  -- 16 hex chars = 64 bits of entropy; this is the secret in an invite link.
  invite_code  text        not null unique
                           default substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
  max_members  integer     not null default 2 check (max_members between 2 and 12),
  created_by   uuid        references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table if not exists public.participants (
  id           uuid        primary key default gen_random_uuid(),
  board_id     uuid        not null references public.boards(id) on delete cascade,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  display_name text        check (display_name is null or char_length(display_name) <= 40),
  -- Day 1 of the current attempt, in the participant's OWN local calendar.
  start_date   date        not null default current_date,
  attempt      integer     not null default 1 check (attempt >= 1),
  -- { "YYYY-MM-DD": { "phone": bool, "move": bool, "deep": bool, "build": bool } }
  -- Keys are the owner's local dates. Size-capped so a client can't bloat the row.
  log          jsonb       not null default '{}'::jsonb
                           check (jsonb_typeof(log) = 'object' and pg_column_size(log) < 65536),
  -- IANA zone (e.g. "Europe/Sofia"), so partners in different countries each see
  -- the other's lane on the owner's calendar, not the viewer's.
  timezone     text        not null default 'UTC' check (char_length(timezone) <= 64),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (board_id, user_id)
);

create index if not exists participants_user_id_idx  on public.participants (user_id);
create index if not exists participants_board_id_idx on public.participants (board_id);

-- ─── updated_at trigger ────────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists participants_touch_updated_at on public.participants;
create trigger participants_touch_updated_at
  before update on public.participants
  for each row execute function public.touch_updated_at();

-- ─── Membership helper ─────────────────────────────────────────────────────
-- SECURITY DEFINER so policies on participants can consult participants without
-- recursing into their own RLS.

create or replace function public.is_board_member(p_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.participants
    where board_id = p_board_id and user_id = auth.uid()
  );
$$;

-- ─── Row-Level Security ────────────────────────────────────────────────────

alter table public.boards       enable row level security;
alter table public.participants enable row level security;

-- boards: members can read their board. Creating and joining go through RPCs only.
drop policy if exists "boards: members read" on public.boards;
create policy "boards: members read" on public.boards
  for select to authenticated
  using (public.is_board_member(id));

-- participants: read everyone on boards you belong to.
drop policy if exists "participants: board members read" on public.participants;
create policy "participants: board members read" on public.participants
  for select to authenticated
  using (public.is_board_member(board_id));

-- participants: update only your own row.
drop policy if exists "participants: update own row" on public.participants;
create policy "participants: update own row" on public.participants
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No INSERT or DELETE policies: rows are only created by create_board() / join_board().

-- Column-level privileges: even on your own row, you cannot move it to another
-- board or reassign it to another user. Only the progress columns are writable.
revoke all on public.boards       from anon, authenticated;
revoke all on public.participants from anon, authenticated;
grant select on public.boards       to authenticated;
grant select on public.participants to authenticated;
grant update (display_name, start_date, attempt, log, timezone)
  on public.participants to authenticated;

-- ─── RPCs: create / join ───────────────────────────────────────────────────
-- A user may belong to at most this many boards (abuse guard).

create or replace function public.create_board(
  p_display_name text,
  p_start_date   date,
  p_timezone     text
)
returns public.boards
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_board public.boards;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_start_date not between current_date - 1 and current_date + 1 then
    raise exception 'bad_start_date' using errcode = '22023';
  end if;
  if (select count(*) from public.participants where user_id = v_uid) >= 5 then
    raise exception 'too_many_boards' using errcode = '53400';
  end if;

  insert into public.boards (created_by) values (v_uid) returning * into v_board;

  insert into public.participants (board_id, user_id, display_name, start_date, timezone)
  values (v_board.id, v_uid, nullif(trim(p_display_name), ''), p_start_date,
          coalesce(nullif(p_timezone, ''), 'UTC'));

  return v_board;
end;
$$;

create or replace function public.join_board(
  p_invite_code  text,
  p_display_name text,
  p_start_date   date,
  p_timezone     text
)
returns public.boards
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_board public.boards;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_start_date not between current_date - 1 and current_date + 1 then
    raise exception 'bad_start_date' using errcode = '22023';
  end if;

  -- Lock the board row so two people can't race past the member cap.
  select * into v_board from public.boards
  where invite_code = p_invite_code
  for update;

  if not found then
    raise exception 'invalid_invite' using errcode = 'P0002';
  end if;

  -- Already on it? Joining again is a no-op.
  if exists (select 1 from public.participants
             where board_id = v_board.id and user_id = v_uid) then
    return v_board;
  end if;

  if (select count(*) from public.participants where board_id = v_board.id)
     >= v_board.max_members then
    raise exception 'board_full' using errcode = '53400';
  end if;
  if (select count(*) from public.participants where user_id = v_uid) >= 5 then
    raise exception 'too_many_boards' using errcode = '53400';
  end if;

  insert into public.participants (board_id, user_id, display_name, start_date, timezone)
  values (v_board.id, v_uid, nullif(trim(p_display_name), ''), p_start_date,
          coalesce(nullif(p_timezone, ''), 'UTC'));

  return v_board;
end;
$$;

revoke all on function public.create_board(text, date, text)     from public, anon;
revoke all on function public.join_board(text, text, date, text) from public, anon;
revoke all on function public.is_board_member(uuid)              from public, anon;
grant execute on function public.create_board(text, date, text)     to authenticated;
grant execute on function public.join_board(text, text, date, text) to authenticated;
grant execute on function public.is_board_member(uuid)              to authenticated;

-- ─── Realtime ──────────────────────────────────────────────────────────────
-- Realtime postgres_changes respects the SELECT policy above, so subscribers only
-- receive changes for boards they belong to.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'participants'
  ) then
    alter publication supabase_realtime add table public.participants;
  end if;
end;
$$;
