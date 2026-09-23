// Pure helpers that turn backend data into what the flame and Today screen show.
// No I/O. Unit-test these.
import type { Clan, Gear, Member } from './types';

export type Stage = 'spark' | 'flame' | 'blaze' | 'inferno' | 'phoenix';
export type Mood = 'hungry' | 'half' | 'full' | 'anxious' | 'dead';

export const MILESTONES = [7, 14, 21, 30, 45, 50, 60, 75, 100, 150, 200, 300] as const;

/** YYYY-MM-DD for "now" in the member's own time zone. */
export function localDate(tz: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Whole days between two YYYY-MM-DD strings (b - a). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** Day N = days since current run started + 1. */
export function currentDay(member: Member, tz: string, now = new Date()): number {
  return daysBetween(member.start_date, localDate(tz, now)) + 1;
}

/** Stage by fraction of the challenge completed in the current run. Finished → phoenix. */
export function stageFor(day: number, length: number, finished: boolean): Stage {
  if (finished) return 'phoenix';
  const f = (day - 1) / length;
  if (f < 0.08) return 'spark';
  if (f < 0.25) return 'flame';
  if (f < 0.5) return 'blaze';
  if (f < 0.83) return 'inferno';
  return 'phoenix';
}

/** Milliseconds until the member's local midnight. */
export function msToMidnight(tz: string, now = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    .formatToParts(now)
    .reduce<Record<string, number>>((o, p) => (p.type !== 'literal' ? { ...o, [p.type]: Number(p.value) } : o), {});
  const elapsed = (parts.hour * 3600 + parts.minute * 60 + parts.second) * 1000;
  return 86_400_000 - elapsed;
}

/** Daily energy state. "Anxious" = 3h or less left and something unchecked. */
export function moodFor(doneCount: number, total: number, msLeft: number): Mood {
  if (doneCount >= total) return 'full';
  if (msLeft <= 3 * 3600_000) return 'anxious';
  return doneCount === 0 ? 'hungry' : 'half';
}

/** Which gear is unlocked. Gear is tied to best_run; crown to any finish. */
export function unlockedGear(bestRun: number, finishedAny: boolean): Record<Gear, boolean> {
  return { none: true, headband: bestRun >= 7, horns: bestRun >= 30, crown: finishedAny };
}

export function nextUnlock(bestRun: number, finishedAny: boolean): { gear: Gear; progress: number; target: number } | null {
  if (bestRun < 7) return { gear: 'headband', progress: bestRun, target: 7 };
  if (bestRun < 30) return { gear: 'horns', progress: bestRun, target: 30 };
  if (!finishedAny) return { gear: 'crown', progress: 0, target: 1 };
  return null;
}

/** Scars shown on the flame: one per previous attempt, max 3. */
export const scarsFor = (attempt: number) => Math.max(0, Math.min(3, attempt - 1));

/** Screen-reader label (brief §9). */
export function flameLabel(stage: Stage, day: number, done: number, total: number, dead = false): string {
  if (dead) return `Your flame is out. It reached Day ${day}.`;
  const s = stage[0].toUpperCase() + stage.slice(1);
  return `Your flame: ${s}, Day ${day}, ${done} of ${total} tasks done`;
}

/** Today's done map for the member. */
export function todayDone(member: Member, clan: Clan, tz: string, now = new Date()): boolean[] {
  const today = member.log[localDate(tz, now)] ?? {};
  return clan.tasks.map((t) => !!today[t.key]);
}
