# The 90

A 90-day accountability board for two. Each person keeps a lane with four daily
non-negotiables. Miss even one in a day and you restart at Day 1 (an honest, self-called
restart). Both lanes sit side by side and update live. You can only check your own boxes.

Built to be **multi-tenant from day one**: anyone can sign up, start a board, and invite one
friend by link. Each board is private to its members, enforced by Postgres Row-Level Security.

**Stack:** Next.js 16 (App Router, TypeScript) · React 19 · Supabase (Postgres, Auth magic
link, Realtime) · hand-written CSS · deployed on Vercel.

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
2. **Run the schema:** open *SQL Editor → New query*, paste all of `supabase/schema.sql`, run it.
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
6. **Sign-ups:** leave public sign-ups **on**. Privacy comes from RLS: strangers can create
   their own boards but can never see yours. For a private two-person deployment instead,
   turn sign-ups off under *Authentication → Sign In / Providers* and invite both emails from
   *Authentication → Users → Invite*.

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel: *Add New → Project → Import* the repo (the framework is auto-detected).
3. Add env vars `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, then deploy.
4. Back in Supabase, set the **Site URL** to the Vercel domain and make sure it's in **Redirect URLs**.

---

## How it works

- **Boards:** a board holds up to 2 participants (`boards.max_members`, which the DB caps at 12).
  "Start Day 1" calls `create_board()`. The invite link `/?join=<code>` calls `join_board()`.
- **Days** are the owner's *local* calendar day. Each participant row stores an IANA
  `timezone`, so a friend in Tokyo sees your lane on your calendar, not theirs.
- **Realtime:** the client subscribes to `postgres_changes` on `participants` filtered to the
  board and refetches on any change.

## Security model

All of it lives in `supabase/schema.sql`:

| What | Rule |
|---|---|
| Read boards / participants | only boards you're a member of |
| Update participants | only your own row, and only `display_name, start_date, attempt, log, timezone` (column grants) |
| Insert participants / boards | never directly; only through `create_board()` / `join_board()` (security definer, invite code required, member cap enforced under a row lock) |
| Delete | not allowed from the client |
| Abuse guards | ≤ 5 boards per user, `log` capped at 64 KB, text length checks |

The anon key is public by design. The client writes only to its own row, one write at a time.

## Roadmap to a public launch

- **Custom SMTP** (above) and **CAPTCHA** on sign-in (Supabase supports Turnstile/hCaptcha).
- **Account deletion (GDPR):** needs a server-side function (a Supabase Edge Function using
  the service role) that deletes the auth user; `on delete cascade` removes their rows.
  Add a privacy policy and terms.
- **Leave board / board names / more than two lanes:** the schema already supports these; the UI does not yet.
- **i18n:** UI strings live in `app/page.tsx` and `lib/supabase.ts` (`TASKS`); extract them to a message catalog.
- **Custom tasks per board:** the four keys are fixed today. Making them configurable needs a migration.
- **Server-side auth:** move to `@supabase/ssr` (cookies, middleware, server components) if
  you need SSR of signed-in pages or server-side route protection. It isn't needed now:
  every read is protected by RLS.
- **Reminders:** PWA + web push, or a daily email.
