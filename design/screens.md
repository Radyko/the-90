# Screen map → routes → components → data

Artboard names refer to the design canvas, page **App screens** (rows: Core loop, Onboarding, Create + join, Clan, Ranks + Me, Dark mode, System). All screens are designed at 390×844, with checks at 375×667 and 430×932 (`R375-today`, `R430-today`).

Legend for data: `profile`, `clan`, `member` (me in this clan), `members[]`, `events[]`, `leaderboard[]` (shapes in `lib/types.ts`).

## App shell
| Piece | Component | Data | Notes |
|---|---|---|---|
| Tab bar | `TabBar` (links, `aria-current`) | – | Today · Clan · Ranks · Me. Sits above the home indicator (`--safe-bottom`). |
| Clan switcher | `ClanSwitcher` (button + sheet list) | user's clans (≤5), pending requests | Only when in >1 clan. Switching sets `<html data-theme>` to that clan's theme. |
| Theme | root layout | `clan.theme` | `data-theme` on `<html>`; dark follows OS. |

## Onboarding (`/signin`, `/auth/callback`, `/setup`, `/start`)
| Artboard | Route | States designed | Data / actions |
|---|---|---|---|
| S01 Sign in | `/signin` | idle | existing magic-link endpoint (email only, no passwords) |
| S03 Sign in errors | `/signin` | invalid email (inline), send error (toast), sending (busy button) | disable submit until valid |
| S02 Sent | `/signin?sent=1` | sent, resend countdown, use different email | |
| S04 Invite preview (signed out) | `/j/[code]` | preview first, then sign in | `clan` preview: name, challenge, length, tasks, member count. **No member names.** Store `code` then continue after auth. |
| S05 Setup · name | `/setup` step 1 | focus, counter 1–32 | `profile.display_name` |
| S06 Setup · make your flame | `/setup` step 2 | hue ring + swatches, eyes, gear locked | `profile.persona` (gear stays `none`). Interactive on canvas. |
| S07 No clan yet | `/start` | two big choices | → `/new` or join sheet (paste link/code) |

## Create clan (`/new`)
| Artboard | Step | States | Data |
|---|---|---|---|
| S08 Pick a challenge | 1/3 | selected card | Templates from `lib/templates.ts` (display names editable in one place: "75 Hard" is a trademark) |
| S09 Tasks | 2/3 | row edit mode, empty-label error, counters 60/120, add (≤10), remove (≥1), drag to reorder, Next disabled while invalid | `clan.tasks[]` |
| S10 Name + leaderboard | 3/3 | counters, toggle | `clan.name` 2–40, `challenge_name` 1–40, `length_days` 7–365 (editable only for Custom), `is_public` default on |
| S11 Invite | done | QR, copy (toast), native share (`navigator.share`), Go to Today | `clan.invite_code`. Creator's Day 1 = today. |

## Join (`/j/[code]`)
| Artboard | States | Data |
|---|---|---|
| S12 Request | signed in, n of 5 clans | create member `status: pending` |
| S13 Pending | live (existing realtime channel, or poll every 15s as fallback), cancel | member status → `active` flips to S14 |
| S14 Approved | celebration | `start_date` = today in my tz |
| S15 Errors | invalid link · full · 5-clan limit · rejected (Tweaks switch on canvas) | backend error codes → copy keys `join.err*` |

## Today (`/` — default tab)
| Artboard | State | Trigger |
|---|---|---|
| S16 Today | in progress (0–3 of N) | default. Flame mood from `moodFor()` |
| S18 Today · 3h left | anxious | `msToMidnight(tz) ≤ 3h` and not all done |
| S17 Day complete | full-screen moment | the check that completes all tasks (once per day) |
| S16 (all done) | resting glow, "Stuffed" line | after closing S17 |
| S20 Break a rule | bottom sheet, hold-to-confirm 1.5s | "I broke a rule today" → backend self-report kill |
| S21 Death | full-screen takeover | next open after server marks death (can surface up to ~1h after midnight) |
| S22 Relight | Day 1, attempt n, scars | CTA on S21 |
| S19 Finished · legend | phoenix + crown, tasks closed, share, v2 "What's next" | `member.finished_at` set |
| P01 Prototype | the whole loop, clickable | canvas only |

Today layout (top → bottom): clan switcher · best run · time left → Flame (118px, hero) → big streak number (104px, tabular, fire text-shadow) → "day streak · Day N of L · attempt n" → week strip card with stage pill + flame line → Today tiles (2-up, 1-up under 360px) → Clan quest bar with clanmates' flames → Your run track → "I broke a rule today".

Bindings:
- `day = currentDay(member, profile.timezone)`; `L = clan.length_days`
- `done[] = todayDone(member, clan, tz)`; toggle → upsert `log[today][taskKey]` (only today; past days locked)
- `stage = stageFor(day, L, !!member.finished_at)`; `scars = scarsFor(member.attempt)`
- `lastOutDay` = day reached at last death (from latest `died` event `day`)
- Clan quest = members with today complete ÷ active members

## Clan (`/clan`)
| Artboard | Content | Data |
|---|---|---|
| S23 Clan · members | campfire hero, segmented Members/Feed/Info, rows: rank, flame, name, role, Day N · Attempt n, status chip (Done ✓ / Going / Out · Day 1 / Legend), v2 Stoke | `members[]` sorted by current day desc (legends first) |
| S24 Feed | all event kinds: died (dramatic, danger card), milestone (gold hexagon), day_complete (compact), finished (gold card), joined, left; grouped Today/Yesterday | `events[]` newest first, realtime insert |
| S25 Campfire scaling | 2 / 8 / 30 / 100 | `Campfire` switches to `FlameGlyph` above 40 |
| S26 Leader tools | pending requests (Let in / Reject), capacity bar, invite link + QR + share, clan color, leaderboard toggle, member limit | leader only |
| ClanColor | 6 themes, light + dark preview | **new field** `clan.theme` |
| S27 Info + leave | challenge + tasks, invite, leave dialog (leader handover copy; last-member delete copy) | backend handles succession |

## Ranks (`/ranks`)
| Artboard | Content |
|---|---|
| S28 Ranks | podium top 3 (gold/silver/bronze), rows 4+: rank, badge, name, challenge · members · alive today, avg run; "Your clan" highlight; v2 filters/seasons |
| S29 Empty | "No ranked clans yet" + invite CTA |
Only clans with ≥2 members and `is_public`. No person names anywhere on this tab.

## Me (`/me`)
| Artboard | Content |
|---|---|
| S30 Me | flame (hero) with gear + scars, name edit, stats (best run, flames lost, finished, clans), color, eyes, gear (locked with progress), time zone (read-only, auto), sign out; v2: trophies, reminders, language, privacy, delete account |
| S31 Gear unlocked | dialog after `best_run` crosses 7 / 30 or first finish |
| S32 Reminder prompt (v2) | in-app pre-permission sheet before `Notification.requestPermission()` |

## System (everywhere)
S33: loading skeleton with ember loader · offline banner + per-tile sync states (waiting / saving / failed-retry) · realtime reconnecting pill · toasts (success / clan activity / error-retry) · generic error · empty states (feed, requests, members, no feed).

## Dark mode
S16d, S23d, S28d, S30d show Sunset dark. Every screen uses tokens only, so all screens get dark for free. Other themes' dark values are in `globals.css`.

## Share cards (page Flame & brand)
Rendered with `next/og` (`ImageResponse`) at `/api/share/[kind]` → 1080×1920 (story) and 1080×1080 (square). Kinds: `milestone`, `death`, `finish`. Flame is drawn from the same SVG paths (inline the `Flame` markup; `next/og` supports SVG). No text baked into static images; all strings come from `messages/*.json`.
