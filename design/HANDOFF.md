# The 90: design handoff for Claude Code

This bundle is the source of truth for building the UI. The **backend already exists and its rules are final**: build the screens to it, and don't change game logic in the client.

- **Design canvas:** "The 90 — Design" (pages **App screens** and **Flame & brand**). Every screen and state is an artboard; `P01 Prototype` is the clickable core loop.
- **Chosen direction:** *Camp · V2 "Big streak"*. Light, chunky and playful, with a talking flame, a big centered streak number, a week strip and 2-up task tiles. Default clan theme is **Sunset** (coral + deep teal); dark mode is **Sunset dark** (deep teal, not pink).

## Stack (hard requirements)
- **Next.js 16, App Router**, **React 19**, **TypeScript** (strict).
- **One global stylesheet:** `app/globals.css`. All design tokens are CSS custom properties. **No Tailwind, no CSS-in-JS libraries, no component libraries.** Inline `style` is only for values computed at runtime (flame hue, positions).
- **Animation:** SVG + CSS keyframes only (in `globals.css`). No Lottie/Rive/Framer. Every animation has a `prefers-reduced-motion` fallback.
- **Fonts:** `next/font/google`: **Fredoka** (600/700, display and numbers) and **Nunito** (600/700/800, UI). Numbers use `font-variant-numeric: tabular-nums` (`.num`).
  - Why they replaced Bricolage/Instrument: rounded, friendly and legible at small sizes, which suits the game-like tone across a broad 18–30 audience. Both are free and support Latin Extended + Vietnamese; for Arabic/Hebrew, add **Noto Sans Arabic / Noto Sans Hebrew** as a fallback via `next/font`.
- **Mobile-first PWA:** installable, `public/manifest.webmanifest`, icons in `public/icons/`. Respect safe areas (`env(safe-area-inset-*)`); the tab bar sits above the home indicator.
- **Icons:** `components/Icon.tsx` (custom 24px stroke set). Never use emoji as UI.

```tsx
// app/layout.tsx (sketch)
import { Fredoka, Nunito } from 'next/font/google';
import './globals.css';
const fredoka = Fredoka({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-fredoka' });
const nunito = Nunito({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-nunito' });
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#FFF1EA' };
export const metadata = { manifest: '/manifest.webmanifest', icons: { icon: '/icons/favicon.svg', apple: '/icons/apple-touch-icon.png' } };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  // data-theme = active clan's theme (default 'sunset'); dark mode follows the OS automatically
  return <html lang="en" data-theme="sunset" className={`${fredoka.variable} ${nunito.variable}`}><body>{children}</body></html>;
}
```

## What's in the bundle
```
app/globals.css            tokens (6 clan themes × light/dark), base, every component class, keyframes, reduced motion
components/Flame.tsx       the flame character (stages × moods × eyes × gear × scars) + FlameGlyph for big campfires
components/Campfire.tsx    clan campfire, scales 2 → 100+
components/ProgressTrack.tsx  7–365 day track (dot grid ≤120, week columns above)
components/WeekStrip.tsx   Mon–Sun strip (locale-aware)
components/TaskTile.tsx    2-up task tile with saving / error / retry + haptics
components/Icon.tsx        icon set
lib/types.ts               data shapes (from the backend; do not rename)
lib/flame.ts               day, stage, mood, time-to-midnight, unlocks, a11y labels (pure; unit-test)
lib/templates.ts           challenge templates (trademarked names editable in one place)
lib/taskIcon.ts            picks an icon from a task label
messages/en.json           every UI string + tone of voice (use with next-intl or similar)
docs/screens.md            screen → route → component → data mapping + all states
docs/motion.md             durations, easing, haptics, reduced motion, sound (v2)
public/manifest.webmanifest, public/icons/*  PWA icons (192, 512, maskable 512, apple 180, favicon svg/32)
```

## Build order (suggested)
1. `globals.css` + layout + tab bar + `data-theme` switching.
2. `Flame` (compare against the **Flame character sheet** artboard) and `lib/flame.ts` with tests.
3. **Today** (S16) wired to real data: tiles, stoke, week strip, track, clan quest. Then S18, S17, S20.
4. Death → relight (S21, S22) and finished (S19).
5. Clan (S23–S27), Ranks (S28–S29), Me (S30–S31).
6. Onboarding, create, join (S01–S15).
7. System states (S33), share cards (`next/og`), PWA polish.

## Game rules the UI must respect (from the backend)
- A **day is the member's own local calendar day**. Always say "your day" / "your midnight". Clanmates may be in other time zones.
- Only **today** is checkable; past days are locked. Unchecking today is allowed.
- At **your midnight** with anything unchecked, the flame dies (server-side, checked hourly and on app open, so a death can appear up to ~1h late). Show the **death takeover (S21) on the next open** after a death, once.
- Death: attempt +1, deaths +1, best_run updates, back to Day 1 today. The feed shows "Oscar's flame went out on Day 23."
- "I broke a rule today" kills immediately. It uses a **hold-to-confirm** (1.5s) sheet (S20).
- Finishing the final day sets `finished_at`: phoenix + crown, tasks closed (S19).
- Milestones: 7, 14, 21, 30, 45, 50, 60, 75, 100, 150, 200, 300.
- Clan limits: name 2–40, challenge 1–40, length 7–365, tasks 1–10 (label ≤60, hint ≤120). A person can be in ≤5 clans (pending requests count). Default capacity 100, max 500.
- Ranks: only clans with ≥2 members and `is_public`, ranked by average current run. **No person names on Ranks.**

## Theming
- `data-theme` on `<html>` = the **active clan's** theme (`clan.theme`, default `sunset`). Switching clans switches the theme (transition `background 240ms`).
- **New backend field needed:** `clan.theme: 'sunset' | 'campfire' | 'forest' | 'lake' | 'berry' | 'sand'`, set by the leader (artboard *Leader · clan color*). Until it exists, hard-code `sunset`.
- Light/dark follows `prefers-color-scheme`. `data-mode="light|dark"` is reserved for a v2 manual toggle.
- The **person's flame hue** is separate: set `style={{ '--fire-h': persona.hue }}` on the Today screen root, so checks, the stage pill and the number's shadow use their own color. Chrome never depends on the hue, so blue, green and violet flames all work.

## Accessibility (WCAG 2.2 AA)
- Text contrast is checked for every token pair in light and dark (ink/muted on bg and card ≥4.5:1; brand buttons use large bold text ≥3:1).
- Visible focus: `:focus-visible` 3px outline everywhere. Touch targets ≥44×44 (tiles are 128px tall).
- **Never color alone:** Done/Going/Out/Legend chips carry an icon + label; dead flames differ in **shape** (grey ember, ✕✕ eyes, smoke) and label.
- Flame `aria-label` via `flameLabel()` (e.g. "Your flame: Blaze, Day 23, 2 of 4 tasks done"). Decorative flames (lists) are `aria-hidden` with the text next to them.
- Tiles are `button[aria-pressed]`; switches are `role="switch"`; sheets/dialogs trap focus and restore it; toasts use `role="status"`/`role="alert"`.
- i18n: layouts tolerate +40% text (tiles wrap, fall back to 1 column under 360px); use logical properties (`inset-inline`, `margin-inline`) so RTL mirrors. Format dates and numbers with `Intl` in the viewer's locale. No text in images: share cards render live text.

## Performance
- Flame is ~2 KB of SVG. In lists pass `static` (no glow, no embers). Campfires with 41+ members render `FlameGlyph` (single path, no animation). Test a 100-member clan on a mid-range Android.
- Only the hero flame animates continuously; pause it when the tab is hidden (`document.visibilityState`).

## v2 (designed, don't build yet)
Anything in a dashed box with a **V2** tag: Stoke a friend / Send a spark, photo proof + vouching, push reminders (S32 prompt + copy in `messages.push`), ranks filters + seasons, trophies, "What's next" after finishing, manual dark toggle, language, delete account, sound. More gear ideas are on the character sheet (ember trail, clan banner, seasonal hats, legend aura).

## Open decisions for the team
- **App name:** "The 90" is also a template name. Candidates floated: *Stoke*, *Kinfire*, *Keep Lit*. It's a one-line change in `messages/en.json` + manifest.
- `clan.theme` field (see Theming).
