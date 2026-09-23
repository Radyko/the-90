-- Game-rule and security tests. Run with: npm run test:db
-- Acting as a user = `set role authenticated` + setting the JWT subject.
-- Time travel = `reset role` and rewriting start_date / log as the superuser.

set client_min_messages = notice;

-- ─── Test helpers ───────────────────────────────────────────────────────────
create schema t;
grant usage on schema t to anon, authenticated;

create function t.ok(p_cond boolean, p_label text) returns void language plpgsql as $$
begin
  if p_cond is not true then raise exception 'FAIL: %', p_label; end if;
  raise notice 'ok  %', p_label;
end;
$$;

-- Runs p_sql (as the current role) and asserts it errors with a message containing p_expect.
create function t.fails(p_sql text, p_expect text, p_label text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if position(p_expect in sqlerrm) > 0 then
      raise notice 'ok  % (%)', p_label, sqlerrm;
      return;
    end if;
    raise exception 'FAIL: % — expected "%", got "%"', p_label, p_expect, sqlerrm;
  end;
  raise exception 'FAIL: % — expected an error "%", got none', p_label, p_expect;
end;
$$;

create function t.act_as(p_user uuid) returns void language sql as
  $$ select set_config('request.jwt.claim.sub', p_user::text, false) $$;

grant execute on all functions in schema t to anon, authenticated;

create table t.ids (name text primary key, id uuid);
grant all on t.ids to authenticated;
insert into t.ids values
  ('raddy',    'aaaaaaaa-0000-0000-0000-000000000001'),
  ('oscar',    'bbbbbbbb-0000-0000-0000-000000000002'),
  ('stranger', 'cccccccc-0000-0000-0000-000000000003'),
  ('dana',     'dddddddd-0000-0000-0000-000000000004');
insert into auth.users select id from t.ids;

create function t.id(p_name text) returns uuid language sql stable as
  $$ select id from t.ids where name = p_name $$;
grant execute on function t.id(text) to authenticated;

\set tasks '''[{"key":"phone","label":"Phone-free first hour"},{"key":"move","label":"Move your body"},{"key":"deep","label":"Deep work block"},{"key":"build","label":"Career / build block"}]'''

-- ─── Anonymous access ───────────────────────────────────────────────────────
\warn '── anon'
set role anon;
select t.fails('select * from public.clans', 'permission denied', 'anon cannot read clans');
select t.fails('select public.sync_me()', 'permission denied', 'anon cannot call RPCs');
reset role;

-- ─── Profiles ───────────────────────────────────────────────────────────────
\warn '── profiles'
set role authenticated;
select t.act_as(t.id('raddy'));
insert into public.profiles (id, display_name, persona, timezone)
values (t.id('raddy'), 'Raddy', '{"hue": 20, "eyes": "sharp"}', 'UTC');
select t.fails($$insert into public.profiles (id, display_name) values (t.id('oscar'), 'Imposter')$$,
               'row-level security', 'cannot create a profile for someone else');
select t.fails($$update public.profiles set persona = '{"hue": 999}'$$, 'bad_persona', 'hue out of range rejected');
select t.fails($$update public.profiles set persona = '{"hat": "x"}'$$, 'bad_persona', 'unknown persona key rejected');
select t.fails($$update public.profiles set persona = '{"gear": "crown"}'$$, 'gear_locked', 'crown is locked for a new player');
select t.fails($$update public.profiles set timezone = 'Mars/Olympus'$$, 'Mars/Olympus', 'unknown time zone rejected');

select t.act_as(t.id('oscar'));
insert into public.profiles (id, display_name, timezone) values (t.id('oscar'), 'Oscar', 'Asia/Tokyo');
select t.act_as(t.id('stranger'));
insert into public.profiles (id, display_name) values (t.id('stranger'), 'Stranger');
select t.act_as(t.id('dana'));
insert into public.profiles (id, display_name, timezone) values (t.id('dana'), 'Dana', 'America/Los_Angeles');

-- ─── Creating and joining ───────────────────────────────────────────────────
\warn '── clans'
select t.act_as(t.id('raddy'));
select t.fails($$select public.create_clan('X', 'The 90', 90, '[]')$$, 'bad_tasks', 'empty task list rejected');
select t.fails($$select public.create_clan('Owls', 'The 90', 90, '[{"key":"a","label":"A"},{"key":"a","label":"B"}]')$$,
               'bad_tasks', 'duplicate task keys rejected');
select t.fails($$select public.create_clan('Owls', 'The 90', 90, '[{"key":"Bad Key","label":"A"}]')$$,
               'bad_tasks', 'invalid task key rejected');
select id as clan, invite_code as code from public.create_clan('Night Owls', 'The 90', 90, :tasks) \gset
select t.ok((select role from public.clan_members where user_id = t.id('raddy')) = 'leader', 'creator is leader');

select t.act_as(t.id('oscar'));
select t.ok((select members from public.preview_clan(:'code')) = 1, 'invite preview shows member count');
select t.ok((select count(*) from public.preview_clan('0000000000000000')) = 0, 'bad code previews nothing');
select t.fails($$select public.request_join('0000000000000000')$$, 'invalid_invite', 'bad invite code rejected');
select t.ok(public.request_join(:'code') = :'clan', 'oscar requests to join');
select t.ok(public.request_join(:'code') = :'clan', 'requesting twice is a no-op');
select t.ok((select count(*) from public.clan_board(:'clan')) = 0, 'pending member sees no board');

select t.act_as(t.id('stranger'));
select public.request_join(:'code');
select t.act_as(t.id('dana'));
select public.request_join(:'code');

select t.act_as(t.id('oscar'));
select t.fails(format('select public.respond_request(%L, %L, true)', :'clan', t.id('stranger')),
               'not_leader', 'only the leader approves');

select t.act_as(t.id('raddy'));
select t.ok((select count(*) from public.clan_board(:'clan') where status = 'pending') = 3, 'leader sees 3 pending requests');
select public.respond_request(:'clan', t.id('oscar'), true);
select public.respond_request(:'clan', t.id('dana'), true);
select public.respond_request(:'clan', t.id('stranger'), false);

select t.act_as(t.id('stranger'));
select t.ok((select count(*) from public.clans) = 0, 'rejected stranger cannot see the clan');
select t.ok((select count(*) from public.profiles) = 1, 'stranger sees only their own profile');
select t.ok((select count(*) from public.clan_events) = 0, 'stranger sees no events');

select t.act_as(t.id('oscar'));
select t.ok((select count(*) from public.clan_board(:'clan')) = 3, 'member sees 3 active on the board');
select t.ok((select count(*) from public.profiles) = 3, 'member sees clanmates'' profiles');

-- ─── Direct writes and private functions are off-limits ─────────────────────
\warn '── lockdown'
select t.fails('update public.clan_members set deaths = 0', 'permission denied', 'no direct member updates');
select t.fails($$insert into public.clan_events (clan_id, kind) values (gen_random_uuid(), 'joined')$$,
               'permission denied', 'no direct event inserts');
select t.fails($$update public.clans set length_days = 7$$, 'permission denied', 'no direct clan updates');
select t.fails(format('select private.kill_member(%L, %L, 0, current_date)', :'clan', t.id('raddy')),
               'permission denied', 'private.kill_member not callable');
select t.fails('select private.evaluate_all()', 'permission denied', 'private.evaluate_all not callable');
select t.fails(format('select private.evaluate_member(%L, %L)', :'clan', t.id('raddy')),
               'permission denied', 'private.evaluate_member not callable');

-- ─── Playing a day ──────────────────────────────────────────────────────────
\warn '── check tasks'
select t.fails(format('select public.check_task(%L, %L, true)', :'clan', 'nope'), 'unknown_task', 'unknown task rejected');
select public.check_task(:'clan', k, true) from unnest(array['phone', 'move', 'deep']) k;
select t.ok((select tasks_done from public.clan_board(:'clan') where user_id = t.id('oscar')) = 3, 'board shows 3/4 done');
select t.ok(not (select done_today from public.clan_board(:'clan') where user_id = t.id('oscar')), 'not done yet');
select public.check_task(:'clan', 'build', true);
select t.ok((select done_today from public.clan_board(:'clan') where user_id = t.id('oscar')), 'done today after 4/4');
select t.ok((select count(*) from public.clan_events where kind = 'day_complete') = 1, 'day_complete event logged');
select public.check_task(:'clan', 'build', false);
select public.check_task(:'clan', 'build', true);
select t.ok((select count(*) from public.clan_events where kind = 'day_complete') = 1, 'uncheck + recheck does not double-log');

-- ─── Stoke ──────────────────────────────────────────────────────────────────
\warn '── stoke'
select t.fails(format('select public.stoke(%L, %L)', :'clan', t.id('oscar')), 'cannot_stoke_self', 'cannot stoke yourself');
select public.stoke(:'clan', t.id('dana'));
select t.fails(format('select public.stoke(%L, %L)', :'clan', t.id('dana')), 'already_stoked', 'one stoke per target per day');
select t.act_as(t.id('dana'));
select t.fails(format('select public.stoke(%L, %L)', :'clan', t.id('oscar')), 'already_done_today', 'cannot stoke someone who is done');

-- ─── Death at midnight ──────────────────────────────────────────────────────
\warn '── death'
reset role;
-- Dana (LA): completed her first two days, missed the third, which has now ended.
update public.clan_members set
  start_date = private.user_today(t.id('dana')) - 3,
  log = jsonb_build_object(
    (private.user_today(t.id('dana')) - 3)::text, '{"phone":true,"move":true,"deep":true,"build":true}'::jsonb,
    (private.user_today(t.id('dana')) - 2)::text, '{"phone":true,"move":true,"deep":true,"build":true}'::jsonb,
    (private.user_today(t.id('dana')) - 1)::text, '{"phone":true,"move":true,"deep":true}'::jsonb)
where user_id = t.id('dana');
select private.evaluate_all();
select private.evaluate_all();  -- idempotent
select t.ok((select deaths = 1 and attempt = 2 and best_run = 2
                    and start_date = private.user_today(t.id('dana'))
             from public.clan_members where user_id = t.id('dana')), 'dana died once, best run 2, restarted today');
select t.ok((select day = 2 and meta ->> 'attempt' = '1' from public.clan_events where kind = 'died'),
            'died event: survived 2 days, attempt 1');

-- Backfilling is impossible: check_task only ever writes today.
set role authenticated;
select t.act_as(t.id('dana'));
select public.check_task(:'clan', 'phone', true);
reset role;
select t.ok((select log -> private.user_today(t.id('dana'))::text = '{"phone": true}'
               and log -> (private.user_today(t.id('dana')) - 1)::text = '{"phone":true,"move":true,"deep":true}'
             from public.clan_members where user_id = t.id('dana')),
            'checks land on today only; the missed day stays missed');
set role authenticated;
select t.act_as(t.id('dana'));
select public.self_report_fail(:'clan');
select t.ok((select deaths from public.clan_members where user_id = t.id('dana')) = 2, 'self-report kills the flame');

-- ─── Time-zone hop can't buy a day ──────────────────────────────────────────
\warn '── timezone'
reset role;
-- Raddy missed yesterday. Hopping to a zone where "yesterday" is still today must not save him.
update public.clan_members set start_date = private.user_today(t.id('raddy')) - 1, log = '{}',
       last_evaluated = null
 where user_id = t.id('raddy');
set role authenticated;
select t.act_as(t.id('raddy'));
update public.profiles set timezone = 'Pacific/Pago_Pago' where id = t.id('raddy');
select t.ok((select deaths from public.clan_members where user_id = t.id('raddy')) = 1,
            'missed day is judged under the old zone before the switch');
select t.fails($$update public.profiles set timezone = 'UTC'$$, 'timezone_change_too_soon', 'second tz change within 12h rejected');

-- ─── Leader tools ───────────────────────────────────────────────────────────
\warn '── leader tools'
select t.ok((select name from public.update_clan(:'clan', 'Night Owls FC', null)) = 'Night Owls FC', 'leader renames clan');
select t.ok(public.rotate_invite(:'clan') <> :'code', 'invite rotated');
select t.act_as(t.id('stranger'));
select t.fails(format('select public.request_join(%L)', :'code'), 'invalid_invite', 'old invite link is dead');
select t.act_as(t.id('raddy'));
select t.fails(format('select public.remove_member(%L, %L)', :'clan', t.id('raddy')), 'use_leave_clan', 'leader cannot remove self');
select public.remove_member(:'clan', t.id('dana'));
select t.ok((select meta ->> 'removed' from public.clan_events where kind = 'left') = 'true', 'removal logged');
select public.transfer_leadership(:'clan', t.id('oscar'));
select t.ok((select role from public.clan_members where user_id = t.id('oscar')) = 'leader', 'leadership transferred');
select t.fails(format('select public.rotate_invite(%L)', :'clan'), 'not_leader', 'ex-leader lost powers');

-- ─── Finishing + gear unlocks ───────────────────────────────────────────────
\warn '── finish'
reset role;
update public.clan_members set start_date = private.user_today(t.id('oscar')) - 89, log = '{}',
       last_evaluated = private.user_today(t.id('oscar')) - 1
 where user_id = t.id('oscar');
set role authenticated;
select t.act_as(t.id('oscar'));
select t.ok((select stage from public.clan_board(:'clan') where user_id = t.id('oscar')) = 'phoenix', 'day 90 is phoenix stage');
select t.ok((select unlocked_gear from public.my_stats()) @> array['headband', 'horns'], 'long run unlocks headband + horns');
select public.check_task(:'clan', k, true) from unnest(array['phone', 'move', 'deep', 'build']) k;
select t.ok((select finished from public.clan_board(:'clan') where user_id = t.id('oscar')), 'oscar finished');
select t.ok((select count(*) from public.clan_events where kind = 'finished') = 1, 'finished event logged');
select t.fails(format('select public.check_task(%L, %L, false)', :'clan', 'phone'), 'already_finished', 'finished runs are locked');
update public.profiles set persona = '{"gear": "crown"}' where id = t.id('oscar');
select t.ok((select persona ->> 'gear' from public.profiles where id = t.id('oscar')) = 'crown', 'finisher can wear the crown');

-- ─── Leaderboard ────────────────────────────────────────────────────────────
\warn '── leaderboard'
select t.act_as(t.id('stranger'));
select t.ok((select members from public.clan_leaderboard()) = 2, 'leaderboard shows clan aggregates to outsiders');
select t.ok(not (select is_mine from public.clan_leaderboard()), 'not marked as the stranger''s clan');
select t.act_as(t.id('oscar'));
select public.update_clan(:'clan', null, false);
select t.ok((select count(*) from public.clan_leaderboard()) = 0, 'private clans are unlisted');

-- ─── Leaving and account deletion ───────────────────────────────────────────
\warn '── leave + delete'
select public.delete_account();
reset role;
select t.ok(not exists (select 1 from auth.users where id = t.id('oscar')), 'account deleted');
select t.ok((select role from public.clan_members where user_id = t.id('raddy')) = 'leader',
            'leader handed back to the remaining member');
set role authenticated;
select t.act_as(t.id('raddy'));
select public.leave_clan(:'clan');
reset role;
select t.ok(not exists (select 1 from public.clans where id = :'clan'), 'last one out closes the clan');

\warn '── all tests passed'
