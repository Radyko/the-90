# Claude Design brief: "The 90"

You are the lead product designer for **The 90**, a mobile-first web app where groups of friends
("clans") take on a hard daily challenge together (75 Hard, 75 Soft, The 90, or their own), and
each person keeps a living **flame** alive by completing every task, every day. Miss one day and
your flame dies, and you're back at Day 1 in front of your whole clan.

I need you to design the complete product: the visual identity, the design system, every screen
and state, the flame character and its animations, and a clickable prototype of the core loop.
Then produce a **handoff bundle for Claude Code**. The backend already exists and its rules are
final (listed below), so design exactly to them. Where I mark something **v2**, design it but
keep it visually separate so it's clear it isn't built yet.

Work in this order and show me each step before moving on:
1. **Three distinct visual directions** (mood board + one hero screen each: the Today screen).
2. After I pick one: **design system** (tokens + components).
3. **Flame character sheet** (all stages × states × customizations).
4. **All screens and states** at 390×844 (iPhone 15), with a check at 375×667 and 430×932.
5. **Interactive prototype** of the core loop (below).
6. **Motion spec**, app icon, splash, and share cards.
7. **Handoff bundle for Claude Code** (see the last section).

---

## 1. Product in one breath

Hardcore daily challenge × a character you care about × a clan that wins or loses together.

- The 75 Hard-style apps on the market (Forge, 75 Hard Together, the official app) are
  **checklists with leaderboards**: functional, spreadsheet-like, no soul.
- The virtual-pet habit apps (Finch, Habit-chi, Habbie) are **cute and solo**, and forgiving
  (in Finch nothing bad happens if you miss).
- Habitica has parties and consequences, but it's a cluttered 8-bit RPG and not built for
  75/90-day challenges.

**Our gap:** consequences that feel real, a character that visibly evolves over 90 days, and a
group that watches each other's fires. It should feel like a **game you're proud to be in**, not
a wellness app. Think night, fire, grit, camaraderie. Discipline with warmth.

## 2. Audience

- 18–30, worldwide. Friend groups, university clubs, **US fraternities and sororities**, sports
  teams, gyms, group chats that decided to "do 75 Hard together".
- Used **on the phone**, many times a day, often one-handed, often at 6am or 11pm.
- They share on Instagram/TikTok. A good-looking milestone is free marketing.
- Group sizes range from 2 friends to 100+ (a frat). Designs must work for both.

## 3. The core loop (prototype this end-to-end)

1. Open the app → see **my flame** and today's tasks, plus how many hours are left in my day.
2. Tap a task to check it off → the flame **stokes** (grows or brightens a notch per task).
3. All tasks done → **"Day N complete"** moment: flame burst, today's cell fills on the track,
   and the clan feed announces it.
4. Glance at the **clan campfire**: whose flames are lit, who's still going today, who died.
5. Midnight (in MY time zone) with anything unchecked → the flame **dies** (automatically,
   server-side). Next open: a dramatic **death screen**, then **relight at Day 1**.
6. Reach the final day and complete it → **Phoenix / finished** celebration + shareable card.

## 4. Game rules (final; enforced by the backend)

Design every screen to match these exactly.

**Days and time**
- A "day" is the member's **own local calendar day** (their time zone). Clanmates in different
  countries each run on their own clock.
- You can only check tasks for **today**. Past days are locked, so no backfilling.
- You can uncheck a task today (honesty).
- At your local midnight, if any task for that day is unchecked, your flame **dies**. The server
  checks every hour and on app open, so a death can surface up to ~1 hour after midnight.
- Day N = days since your current run started + 1. Shown as "Day N of L" (L = challenge length).

**Death and restart**
- Death: attempt + 1, deaths + 1, `best_run` updates, back to **Day 1 today**. The clan feed
  shows "Oscar's flame went out on Day 23."
- **Self-report**: "I broke a rule today" (e.g. ate dessert) kills the flame immediately. It's an
  honor system that needs a serious confirm screen.
- Stats per member: current day, **attempt #**, **deaths**, **best run**, finished (yes/no).

**Finishing**
- Completing all tasks on the final day → **finished**. The flame becomes permanent (Phoenix /
  legend state). A finished member can't check tasks anymore; they're a legend in the clan.

**Milestones** (feed events + celebration): completing day 7, 14, 21, 30, 45, 50, 60, 75, 100,
150, 200, 300.

**Clans**
- Name 2–40 chars. Challenge name 1–40 chars. Length 7–365 days. **1–10 tasks**, each with a
  label (≤60 chars) and an optional hint (≤120 chars).
- **Templates** to pick from when creating:
  - **75 Hard** (75 days): two 45-min workouts (one outdoors) · follow a diet, no cheat meals, no
    alcohol · drink a gallon of water · read 10 pages of non-fiction · take a progress photo.
    (Note: "75 Hard" is a trademark. Design the template picker so the display names are easy to
    change.)
  - **75 Soft** (75 days): eat well, drink only socially · 45-min workout (one day a week can be
    active recovery) · 3 L of water · read 10 pages.
  - **The 90** (90 days): *Phone-free first hour* ("no phone until your morning block is done") ·
    *Move your body* ("30–60 min: run, lift, or walk; it has to count") · *Deep work block* ("one
    focused session: coursework, research, reading; your call") · *Career / build block* ("30–60
    min: LeetCode, startup, or learning something new").
  - **Custom**: name, length, and 1–10 tasks written by the creator.
- **Joining:** each clan has an invite link. Opening it shows a **preview** (clan name,
  challenge, length, task list, member count; no member names), then **"Request to join"**. The
  **leader approves or rejects**. On approval the new member starts **their own Day 1** that day.
- Roles: **leader** and **member**. If the leader leaves, the longest-standing member becomes
  leader. If the last member leaves, the clan is deleted.
- Default capacity 100 members (max 500). A person can be in **up to 5 clans** (pending requests
  count), each with its own separate flame run.
- "Show on global leaderboard" toggle at creation (default on).

**Clan feed events:** joined · left · day complete (with day #) · milestone (day #) · died (with
the day they reached and which attempt) · finished.

**Global leaderboard (clans vs clans)**
- Only clans with **≥2 members** that opted in.
- Ranked by **average current run** (days alive) across members. Shows: clan name, challenge,
  members, **alive today** (members who've completed today), avg run, and a "your clan" highlight.
- Shows **no individual names** (privacy). Inside a clan, members see each other fully.

**Profile**
- Display name (1–32 chars) + **flame persona** (color hue, eyes, gear) + time zone (auto).
- Sign-in is **email magic link only** (no passwords).

## 5. The flame (the heart of the product; spend your best effort here)

A living flame with a face. It's your persona, and it should feel like **yours**: something you'd
feel bad letting die.

**Must be drawable as SVG and animated with CSS** (it ships as code, not video). Keep it
lightweight (dozens of instances in a 100-person clan campfire).

**Evolution stages** (by fraction of the challenge completed in the current run):
| Stage | Range | Feel |
|---|---|---|
| Spark | < 8% | tiny, fragile, flickers nervously |
| Flame | 8–25% | steady, confident |
| Blaze | 25–50% | bigger, embers start floating up |
| Inferno | 50–83% | powerful, heat shimmer, aura |
| Phoenix | 83–100%, and finished | transcendent, wings or crest of fire, gold |

**Daily energy state** (within any stage): tasks done today = 0 → dim or "hungry"; each task
stokes it; all done → full, bright, content. Late in the day with tasks left → visibly anxious
(faster, erratic flicker). Design 0/4, 2/4, 4/4, and a "3 hours left, 1 task to go" state.

**Customization** (the `persona` object):
- `hue`: any color (a hue wheel; fire in blue, green, violet should all look great)
- `eyes`: round, sharp, sleepy, happy (plus expressions per state: determined, worried, dead ✕✕)
- `gear` (unlockable, tied to `best_run`, the gamification hook):
  - none: default
  - headband: unlocks at a best run of 7 days
  - horns: unlocks at 30 days
  - crown: unlocks when you **finish** a challenge
  - Design locked states ("Reach Day 30 to unlock") and a small unlock celebration.
  - Propose 3–5 more unlockables for v2 (e.g. scars that show how many attempts you've survived).

**Death**: the flame gutters, shrinks, goes out → a **wisp of smoke** and a grey ember with
✕✕ eyes. It must feel like a real loss (the product depends on it) but not morbid or gory.
**Relight**: a match strike / spark → a tiny Spark at Day 1. Previous attempts leave a mark
(e.g. small scar, attempt number).

Deliver a **character sheet**: 5 stages × {hungry, half, full, anxious, dead} × 4 eye styles,
with gear variants, at 3 sizes (hero ~240px, list ~48px, campfire ~28px).

## 6. Screens and every state

App shell: **bottom tab bar** with **Today · Clan · Ranks · Me**. A clan switcher sits at the
top when you're in more than one clan. Everything important sits in the thumb zone.

**A. Signed-out / onboarding**
1. Landing / sign-in: title, a one-line promise, email field, "Email me a sign-in link". States:
   idle, sending, sent ("Check your email", can use a different email), error, invalid email.
2. Arrived via an **invite link** while signed out: show the clan preview first ("You've been
   invited to Night Owls · The 90 · 12 members") → sign in → continue.
3. First-time setup: display name → **create your flame** (color, eyes; gear shown locked) →
   done.
4. No clan yet: two big choices, **Start a clan** / **Join with a link or code**.

**B. Create clan** (multi-step, one-handed friendly)
1. Pick a template (cards: 75 Hard, 75 Soft, The 90, Custom), showing length + task count.
2. Review or edit tasks (add, remove, reorder, edit label/hint; 1–10; validation states).
3. Name the clan + "Show on global leaderboard" toggle.
4. Done → **invite screen**: link + Copy + native Share + QR code (for in-person, e.g. a frat
   meeting). You start Day 1 today.

**C. Join**
- Invite preview → "Request to join" → **pending screen** ("Waiting for the leader to let you
  in"; your flame is an unlit match). It updates live on approval → celebration → Day 1.
- Error states: invalid link, clan full, you're already in 5 clans, request rejected.

**D. Today (home)**
- Hero: my flame (big), "Day 23 of 90", stage name, attempt # (if >1), deaths, best run.
- **Time left today** countdown (my local midnight).
- Task list: big tappable rows (label + hint), checked and unchecked, a disabled/locked state
  while saving, and an error/retry state.
- **Progress track**: L cells (7–365!) with filled, today (outlined), future, and a death marker.
  Must stay readable at 75, 90, **and 365**.
- Clan pulse strip: small flames of clanmates ("8/12 done today").
- "I broke a rule today" (secondary, serious confirm).
- States: in progress, complete (resting glow), finished (legend), just died (death screen
  first), finished-challenge "what's next" (start a new run / new clan, v2).

**E. Death screen** (full-screen takeover on the next open after a death)
- "Your flame went out on Day 23." Show the run length, attempt #, and best run.
- A single strong CTA: **Relight: Day 1**. Optional: see who's still burning.
- Also design the version **clanmates see** in the feed.

**F. Clan**
- **Campfire hero**: all members' flames arranged around a fire. The fire's intensity =
  % of members who've completed today. It must scale from 2 to 100 flames: design 2, 8, 30,
  and 100 members.
- Members leaderboard (inside the clan): rank, flame, name, Day N, attempt, done today ✓,
  status (alive, dead-restarted, finished/legend). Sort: current day desc.
- **Feed**: event cards for every event type (joined, day complete, milestone, died, finished,
  left). Deaths and milestones are the dramatic ones.
- Leader tools: **pending requests** (approve / reject, with the requester's name and flame),
  invite link / QR, member count / capacity.
- Clan info: challenge, length, task list, invite, **Leave clan** (confirm; leader warning).

**G. Ranks** (global)
- Clan leaderboard as described above, with your clans highlighted. Podium treatment for the
  top 3. Empty state ("No ranked clans yet; you need 2+ members").
- v2: filters (by challenge, by region/campus), seasons.

**H. Me**
- Big flame + customization (hue wheel, eyes, gear with lock states + unlock progress).
- Stats across clans: total deaths, best run, challenges finished, trophies (v2).
- Display name edit, time zone (auto, shown read-only), sign out.
- v2: delete account (GDPR), privacy policy, language.

**I. System states everywhere**: loading skeletons (on-brand, e.g. a flickering ember),
offline, realtime reconnecting, generic error, and empty states for every list.

## 7. Social and growth (design these; some are v2)

- **Share cards** (Instagram story 1080×1920 + square 1080×1080): "Day 30 · Blaze · The 90" with
  the flame; the death card ("Went out on Day 23. Attempt #3 starts now."); the finish card.
  These are our growth engine, so make them beautiful.
- **Stoke a friend** (v2): tap a clanmate who hasn't finished today to send a nudge.
- **Photo proof + vouching** (v2): daily check-in photo (75 Hard requires a progress picture);
  clanmates can vouch or call it out.
- **Push reminders** (v2, PWA): "Your flame has 3 hours left, 1 task to go." Design the copy
  and the in-app permission prompt.
- Invite QR code for in-person groups.

## 8. Visual direction (constraints, then freedom)

- **Mood:** night, campfire, embers, grit, loyalty. Game-like and alive, but **not childish**
  (18–30 year olds share this). References to draw feeling from (not copy): Forest's calm
  growth, Duolingo's streak drama, the warmth of a campfire, athletic training apps, and the
  Dark Souls bonfire as a "checkpoint".
- **Dark-first** (night, so fire glows). Design a light mode too, but dark is the hero.
- Boldness goes to **the flame, the big day numbers, the track, and the campfire**. Everything
  else stays calm and legible.
- **Typography:** we currently use *Bricolage Grotesque* (display, 700/800) and *Instrument
  Sans* (UI, 400/500/600), free on Google Fonts. Keep them or propose better free Google Fonts
  with a reason. Numbers must be tabular.
- **Color:** propose a full token set (bg, surfaces, ink, muted, lines, fire gradient stops,
  success, danger, gold/legend). Flame colors come from each user's hue, so the UI chrome must
  work with **any** hue. Check contrast (WCAG AA for text).
- **Avoid:** generic wellness pastels, purple-gradient "AI app" look, glassmorphism everywhere,
  confetti spam, stock illustration, emoji as UI icons, soft floating card stacks.
- **Motion:** purposeful and game-like: stoke on check, burst on day complete, milestone
  celebration, death sequence, relight, campfire flicker. Give durations and easing. Everything
  must have a **`prefers-reduced-motion`** fallback. Suggest haptics (Vibration API) moments.
- Sound: optional v2 ideas only (crackle, strike); never on by default.

## 9. Accessibility and worldwide

- WCAG AA contrast; visible focus states; 44×44px minimum touch targets; screen-reader labels
  for the flame state ("Your flame: Blaze, Day 23, 2 of 4 tasks done").
- Never rely on color alone (dead vs alive must differ in shape and label, not just color).
- **Internationalization:** layouts must survive text 40% longer (German), and RTL
  (Arabic/Hebrew). Show dates and numbers in the viewer's locale. No text baked into images.
- Time zones: always say "your day" and "your midnight"; clanmates may be in other countries.

## 10. Technical constraints (for the handoff)

- **Mobile web app / PWA** built with **Next.js 16 (App Router) + React 19 + TypeScript**,
  installable to the home screen. Respect **safe-area insets** (notch, home indicator); the
  bottom tab bar sits above the home indicator.
- **Styling:** one hand-written global CSS file with **CSS custom properties** (design
  tokens). **No Tailwind, no component libraries.** Design components so they're easy to build
  by hand.
- **Flame and track:** inline **SVG + CSS animations**. No video, no heavy animation runtime.
  If you believe Lottie/Rive is essential for one moment (e.g. death), justify it and provide
  the SVG/CSS fallback.
- Fonts via `next/font/google`. Icons: a single simple SVG icon set (propose one, or hand-draw
  a small custom set that fits the fire theme).
- Data shapes the UI will bind to:
  - `profile { display_name, persona { hue: 0–359, eyes: 'round'|'sharp'|'sleepy'|'happy', gear: 'none'|'headband'|'horns'|'crown' }, timezone }`
  - `clan { name, challenge_name, length_days, tasks: [{ key, label, hint? }], invite_code, is_public, max_members }`
  - `member { role: 'leader'|'member', status: 'pending'|'active', start_date, attempt, deaths, best_run, finished_at, log: { 'YYYY-MM-DD': { [taskKey]: true } } }`
  - `event { kind: 'joined'|'left'|'day_complete'|'milestone'|'died'|'finished', day, meta, created_at }`
  - `leaderboard row { name, challenge_name, members, alive_today, avg_run, is_mine }`

## 11. Deliverables checklist

- [ ] 3 visual directions → my pick
- [ ] Design system: tokens (color, type scale, spacing, radius, elevation, motion), light + dark
- [ ] Components: buttons, inputs, task row, flame (all variants), progress track (7–365
      cells), campfire, member row, feed event cards (every type), leaderboard row, tab bar, clan
      switcher, dialogs/confirm, toasts, empty/loading/error states, QR invite
- [ ] Flame character sheet (stages × states × eyes × gear × sizes) + death/relight sequence
- [ ] Every screen in section 6, in every listed state, at 390×844 (+375 and 430 checks)
- [ ] Clickable prototype of the core loop (section 3), including death → relight
- [ ] Motion spec (durations, easing, reduced-motion fallbacks, haptics)
- [ ] App icon (PWA: 192, 512, maskable; Apple touch 180), splash, favicon, OG image
- [ ] Share cards (story + square): milestone, death, finish
- [ ] Short copy deck: tone of voice (direct, a bit of grit, never preachy) + all UI strings
- [ ] **Handoff bundle for Claude Code**, with a README stating: Next.js 16 App Router, React
      19, TypeScript, one `globals.css` with the tokens as CSS variables, no Tailwind or
      component libs, SVG/CSS animation, `next/font`, mobile-first PWA, and a mapping from each
      screen/component to the data shapes in section 10.
