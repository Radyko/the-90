# The 90 — project context

## Concept
A 90-day accountability board. Two friends share a private **board**; each keeps a **lane**
with four daily non-negotiables. If you miss even one task in a day, you restart at Day 1
yourself (honor system: a "restart" button, not automatic detection). Lanes update live.
You can only check your own boxes. The app is multi-tenant: anyone can sign up, create a
board, and invite one friend via `/?join=<invite_code>`.

## Stack
- Next.js 16 App Router + TypeScript, React 19, deployed on Vercel.
- Supabase: Postgres + Auth (email magic link, implicit flow) + Realtime.
- **Client-side auth only** (`@supabase/supabase-js` in the browser). This is deliberate: no
  middleware, no server components for auth, no `@supabase/ssr` (a possible future upgrade).
- Hand-written CSS in `app/globals.css`. No CSS framework, no component libraries.

## Files
- `app/layout.tsx`: fonts (Bricolage Grotesque for display, Instrument Sans for body), metadata, viewport.
- `app/page.tsx`: `"use client"`; the auth gate, sign-in, create/join, board, lanes, realtime.
- `app/globals.css`: design tokens and all styles.
- `lib/supabase.ts`: browser client (null if env is missing), types, TASKS, date helpers.
- `supabase/schema.sql`: tables, RLS, grants, RPCs, realtime publication. **Source of truth for security.**

## Data model
- `boards(id, name, invite_code, max_members=2, created_by, created_at)`
- `participants(id, board_id, user_id, display_name, start_date, attempt, log jsonb, timezone, created_at, updated_at)`, with `unique(board_id, user_id)`
- `log` = `{ "YYYY-MM-DD": { phone, move, deep, build } }` (booleans), keyed by the OWNER's local date.
- Day N = (today in owner's timezone − start_date) + 1, capped at 90.
- Restart: `start_date = today`, `attempt + 1`, today's log entry removed.

## The four log keys: DO NOT RENAME without a DB migration
1. `phone`: Phone-free first hour
2. `move`: Move your body
3. `deep`: Deep work block (general, intentionally not school-specific)
4. `build`: Career / build block

## Security invariants
- RLS is the security boundary, not the client.
- SELECT: only boards you're a member of (`is_board_member()`, security definer).
- UPDATE: own participant row only, and only the columns `display_name, start_date, attempt, log, timezone`.
- INSERT: only via `create_board()` / `join_board()` RPCs. No direct insert or delete policies.
- Never put the service_role key in client code or the repo. Never commit `.env.local`.
- Client writes: own row only, one at a time (the `inFlight` guard in `BoardView`).
- Any schema change goes in `supabase/schema.sql` (and a migration once there's production data).

## Design
Training ledger / stopwatch, not a wellness app. Boldness goes to the big day numbers and the
90-cell track. Everything else stays quiet. Left-aligned, minimal radius, lanes divided by
thin rules (no shadowed cards). Exactly one motion: a pulse when today's cell fills.
Tokens are defined in `:root`; dark mode uses `prefers-color-scheme`. Lane accents are
assigned by sorted user_id.

## Run
```bash
npm install
cp .env.local.example .env.local   # fill in URL + anon key
npm run dev
npm run typecheck && npm run build
```
