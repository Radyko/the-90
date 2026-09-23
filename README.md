# The 90

Keep your flame alive. Clans take on a challenge together (75 Hard, 75 Soft, The 90, or
their own). Every member keeps a flame alive by completing every task, every day. Miss a
day and the flame dies: back to Day 1, and the whole clan sees it.

**Stack:** Next.js 16 (App Router, TypeScript) · React 19 · Supabase (Postgres, Auth magic
link, Realtime, pg_cron) · hand-written CSS · Vercel.

**Status:** the backend (game engine, security, API client) is complete and tested. The UI
is being designed from [docs/claude-design-brief.md](docs/claude-design-brief.md).

---

## Local setup

```bash
npm install
cp .env.local.example .env.local   # then fill in the two values
npm run dev                         # http://localhost:3000
```

Other scripts: `npm run typecheck`, `npm run build`, `npm start`.

## Supabase setup

1. **Create a project** at <https://supabase.com/dashboard>.
2. **Run the SQL** in *SQL Editor → New query*, one file at a time, in this order:
   1. `supabase/drop_v1.sql`: only if you ran the old two-person schema. Removes it.
   2. `supabase/schema.sql`: tables, security, game engine. Safe to re-run after changes.
   3. `supabase/cron.sql`: hourly death checks. If it errors, first enable **pg_cron** under
      *Database → Extensions*, then run it again.
3. **Keys:** *Project Settings → API*: copy the **Project URL** and the **anon / publishable**
   key into `.env.local`. Never use the `service_role` / secret key in this app.
4. **Auth URLs:** *Authentication → URL Configuration*:
   - **Site URL:** `http://localhost:3000` (switch it to your Vercel URL once you deploy)
   - **Redirect URLs:** add both
     - `http://localhost:3000/**`
     - `https://<your-app>.vercel.app/**`

     The `/**` wildcard matters: invite links send people back to `/?join=<code>`.
5. **Email delivery (required before real users arrive):** Supabase's built-in mailer is for
   testing only and is heavily rate-limited (a handful of emails per hour). Under
   *Authentication → Emails → SMTP Settings*, plug in a provider such as Resend, Postmark, or SES.
6. **Sign-ups:** leave public sign-ups **on**. Privacy comes from RLS: anyone can sign up
   and create clans, but nobody can see a clan they haven't been let into.

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel: *Add New → Project → Import* the repo (the framework is auto-detected).
3. Add env vars `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, then deploy.
4. Back in Supabase, set the **Site URL** to the Vercel domain and make sure it's in **Redirect URLs**.

---

## How it works

- **Rules live in the database.** Clients can only read (RLS) and call RPCs; every RPC
  validates. For example, tasks can only be checked for your own *today*, so nobody can
  backfill a missed day.
- **Deaths are automatic.** `private.evaluate_member()` judges each ended local day. It
  runs hourly (pg_cron) and whenever the app opens (`sync_me()`).
- **Time zones:** each member plays on their own local calendar. Zone changes are limited
  to one every 12h, and the old zone's ended days are judged first.
- **Internals are private.** The engine lives in a `private` schema that the API doesn't
  expose. Only an explicit list of `public` RPCs is callable.
- **Frontend contract:** `lib/api.ts` (typed calls, realtime, error messages) and
  `lib/types.ts`. Game rules are listed in `CLAUDE.md`.

### Tests

```bash
npm run test:db
```

This spins up a throwaway local Postgres (you need `initdb`, `pg_ctl` and `psql` on PATH),
loads the schema twice, and runs `supabase/tests/game_test.sql`: 60+ checks covering
permissions, joining, deaths, time-zone abuse, leader tools, finishing, gear, the
leaderboard and account deletion.

## Roadmap to a public launch

- **UI** from the Claude Design handoff, built on `lib/api.ts`.
- **Custom SMTP** (above) and **CAPTCHA** on sign-in (Supabase supports Turnstile/hCaptcha).
- **Push reminders** (PWA + web push): "your flame has 3 hours left". Stokes are already
  logged as events, ready to trigger a push.
- **Photo proof + vouching:** needs Supabase Storage and a vouch table.
- **Legal:** privacy policy and terms. Account deletion already exists (`delete_account`).
  Check the "75 Hard" trademark before using the name publicly.
- **i18n**, and **scale**: `evaluate_all` walks every active member hourly. Fine for tens of
  thousands of members; batch it by time zone later.
