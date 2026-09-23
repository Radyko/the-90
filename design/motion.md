# Motion, haptics and sound

Motion here should feel like a game: it rewards and warns. It is never decoration. Everything is CSS (keyframes and classes live in `app/globals.css`). There is no animation runtime and no Lottie/Rive: the death sequence is 4 CSS steps on one SVG, so a runtime isn't worth its weight.

## Easing tokens
| Token | Curve | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` | fades, color changes, sheets in |
| `--ease-spring` | `cubic-bezier(.2,1.4,.4,1)` | stoke, pops, bars filling, celebrations |
| `--ease-in` | `cubic-bezier(.5,0,.75,0)` | things dying or leaving |

## Moments
| Moment | What moves | Duration | Easing | Haptic (`navigator.vibrate`) | Reduced motion |
|---|---|---|---|---|---|
| Button / tile press | `translateY(3px)`, bottom edge 5→2px | 90ms | ease-out | – | instant |
| **Stoke** (check a task) | Flame body scale steps up (stage × (0.85 + 0.15·energy)) + one `.fl-stoke` pulse (1 → 1.14 → 1); tile fills with fire tint; week/track cell unchanged until all done | 420ms | spring | `12` | color change only |
| Uncheck | Flame shrinks one notch, no pulse | 240ms | ease-out | `8` | instant |
| Idle flicker | `.fl-flick` 2.4s loop; `.fl-calm` 4.4s when full; `.fl-spark` 1.1s at Spark stage | loop | ease-in-out | – | static |
| **Anxious** (≤3h left, tasks open) | `.fl-anx` 600ms `steps(5)` jitter, worried brows, time chip turns danger | loop | steps | one `[20,60,20]` when the app opens into this state | static + danger color + label |
| **Day complete** | Full-screen takeover: rays `.burst` 900ms, flame pops 0.6 → 1, "Day N" slides up 16px; today's week dot + track cell fill 150ms after | 900ms | spring | `[30,40,60]` | crossfade 200ms |
| Milestone (7, 14, 21, 30…) | Same as day complete + gold hexagon badge drops in (translateY −24 → 0) | 1100ms | spring | `[30,40,30,40,80]` | crossfade |
| Gear unlock | Dialog scales 0.9 → 1, gold rays `.burst`, gear drops onto flame (−20px → 0) | 700ms | spring | `[20,40,80]` | crossfade |
| **Death sequence** (on next open after death) | 1. flame shows last state 300ms → 2. `.fl-gutter` shrink + desaturate 900ms → 3. swap to dead SVG, smoke `.fl-smoke` starts → 4. title + stats fade up 400ms | ≈ 2.2s, then smoke loops | ease-in → ease-out | one long `200` at step 3 | show dead state immediately, text fades 200ms |
| **Relight** | Match strike (rotate −12° + flare) 400ms → `.fl-strike` spark pops 0.2 → 1.15 → 1 500ms | 900ms | spring | `[10,30,10]` | crossfade |
| Campfire update (realtime) | Fire path `d` morphs to new size; the member's flame pulses once | 420ms | spring | – | instant |
| Bars (clan quest, stage progress) | `width` transition | 420ms | spring | – | instant |
| Sheets / dialogs | Sheet translateY(100%) → 0; dialog scale .96 → 1 + fade; scrim fades | 240ms in / 160ms out | ease-out / ease-in | – | fade only |
| Toasts | Slide down 12px + fade, auto-hide 3.5s (errors stay until dismissed) | 240ms | ease-out | – | fade |
| Skeletons | `.skel` opacity .55 ↔ 1 | 1.4s loop | ease-in-out | – | static |
| Hold to put it out | Fill grows over 1500ms while pressed; releases back in 200ms | 1500ms | linear | tick `5` every 300ms, `[40,60,120]` on confirm | same (it's an input, not decoration) |

## Rules
- Never animate layout properties on lists (no height animation on the members list).
- Max one celebration per app open; queue the rest into the feed.
- `prefers-reduced-motion: reduce` → the global rule in `globals.css` collapses durations; state still changes and is announced.
- Haptics: only call `navigator.vibrate` after a user gesture on that screen. Wrap in `if ('vibrate' in navigator)`. iOS Safari ignores it; that's fine.

## Sound (v2 only, off by default)
- Soft crackle loop under the Today hero at −30 dB when the flame is full.
- Match strike on relight.
- Low "whoomp" on day complete.
- Setting lives in Me → Sound (v2). Never autoplay on first run.
