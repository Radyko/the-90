# The 90 — project context

## Concept
A worldwide, mobile-first web app. People form **clans** (friends, a frat, a gym) that take
on a challenge together: 75 Hard, 75 Soft, The 90, or a custom one. Each member keeps a
**flame** (their persona) alive by completing every task, every day, on their own local
calendar. Miss a day and the flame dies automatically: back to Day 1, and the clan sees
it. Heavily gamified: flame stages, unlockable gear, milestones, stokes (nudges), a clan
feed, and clans-vs-clans leaderboards.

Status: the backend is complete and tested. The UI is being designed in Claude Design
(brief: `docs/claude-design-brief.md`) and will be built on `lib/api.ts`. `app/page.tsx` is
a temporary auth shell.

## Stack
- Next.js 16 App Router + TypeScript, React 19, deployed on Vercel.
- Supabase: Postgres + Auth (email magic link, implicit flow) + Realtime + pg_cron.
- **Client-side auth only** (`@supabase/supabase-js` in the browser). Deliberate: no
  middleware, no `@supabase/ssr` (a possible future upgrade).
- Hand-written CSS in `app/globals.css`. No CSS framework, no component libraries.

## Files
- `supabase/schema.sql`: tables, RLS, the game engine, RPCs, realtime. **Source of truth for rules and security.** Idempotent.
- `supabase/cron.sql`: hourly `private.evaluate_all()` job (deaths when nobody opens the app).
- `supabase/drop_v1.sql`: one-time removal of the old two-person tables.
- `supabase/tests/game_test.sql`: rule + security tests. Run `npm run test:db` (needs local Postgres).
- `lib/api.ts`: typed client for every RPC/read + realtime subscriptions + error-code → message mapping.
- `lib/types.ts`: row / RPC result types (mirror the schema).
- `lib/challenges.ts`: challenge templates + `taskKey()` for custom tasks.
- `lib/supabase.ts`: browser client (null if env is missing).
- `docs/claude-design-brief.md`: the full product/design brief.

## Data model
- `profiles(id = auth uid, display_name, persona {hue, eyes, gear}, timezone, timezone_changed_at)`
- `clans(id, name, challenge_name, length_days 7–365, tasks [{key,label,hint}] 1–10, invite_code, is_public, max_members)`
- `clan_members(clan_id, user_id, role leader|member, status pending|active, start_date, attempt, deaths, best_run, log, finished_at, last_evaluated)`
  - `log` = `{ "YYYY-MM-DD": { taskKey: bool } }`, keyed by the member's local date.
- `clan_events(clan_id, user_id, kind, day, meta)`: kinds joined, left, day_complete, milestone, died, finished, stoke.

## Game rules (enforced in SQL, not the client)
- Day N = (member's local today − start_date) + 1. Each member runs on their own time zone.
- Tasks can be checked **only for today** (`check_task`). No backfilling.
- `private.evaluate_member` judges every ended day. The first incomplete day kills the flame:
  deaths+1, attempt+1, best_run updated, start_date = today. Runs hourly (cron) and via `sync_me()` on app open.
- `self_report_fail` kills now (honor system). Completing the final day → `finished_at`, run locked.
- Each day completion is announced once per attempt; milestones at 7, 14, 21, 30, 45, 50, 60, 75, 100, 150, 200, 300.
- Stages by share of the challenge completed: spark < 8% < flame < 25% < blaze < 50% < inferno < 83% < phoenix.
- Gear unlocks: headband at a 7-day run, horns at 30, crown after finishing. Enforced by the profile trigger.
- Time zone changes: at most once per 12h, and ended days are judged under the old zone first.
- Joining: invite link → `request_join` (pending) → leader `respond_request`. Max 5 clans per user.
- Stoke: nudge a clanmate who isn't done today, once per target per 20h.
- Leader leaves → the longest-standing member becomes leader. Last one out deletes the clan.

## Security invariants
- RLS is the security boundary. You read only clans you're in and their members/events/profiles.
- Game tables have **no direct client writes**. Only the `public` RPCs write, and each validates.
- `private` schema = engine + helpers: not exposed by the Data API, no EXECUTE for clients
  except the three RLS helpers. Supabase grants EXECUTE by default, so schema.sql revokes
  everything and re-grants the RPC list explicitly. Keep it that way for any new function.
- Every function is `security definer` with `set search_path = ''` and fully qualified names.
- Never put the service_role key in client code or the repo. Never commit `.env.local`.
- Any schema change: edit `schema.sql`, add a test in `game_test.sql`, run `npm run test:db`.

## Run
```bash
npm install
cp .env.local.example .env.local   # fill in URL + anon key
npm run dev
npm run typecheck && npm run build
npm run test:db                    # database tests against a throwaway local Postgres
```
