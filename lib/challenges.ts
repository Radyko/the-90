// Challenge templates offered when creating a clan. A clan copies its template's
// tasks at creation time, so editing these never changes existing clans.
// Task keys must match ^[a-z0-9_]{1,24}$ and be unique within a template.

import type { Task } from "./types";

export type ChallengeTemplate = {
  id: string;
  name: string; // "75 Hard" is a trademark (Andy Frisella): confirm before a public launch
  lengthDays: number;
  blurb: string;
  tasks: Task[];
};

export const TEMPLATES: ChallengeTemplate[] = [
  {
    id: "the90",
    name: "The 90",
    lengthDays: 90,
    blurb: "Four daily non-negotiables for ninety days.",
    tasks: [
      { key: "phone", label: "Phone-free first hour", hint: "no phone until your morning block is done" },
      { key: "move", label: "Move your body", hint: "30–60 min: run, lift, or walk; it has to count" },
      { key: "deep", label: "Deep work block", hint: "one focused session: coursework, research, reading; your call" },
      { key: "build", label: "Career / build block", hint: "30–60 min: LeetCode, startup, or learning something new" },
    ],
  },
  {
    id: "75hard",
    name: "75 Hard",
    lengthDays: 75,
    blurb: "The original. No cheat meals, no alcohol, no compromises.",
    tasks: [
      { key: "workout_1", label: "Workout #1 (45 min)", hint: "any training that counts" },
      { key: "workout_2", label: "Workout #2 (45 min, outdoors)", hint: "rain or shine" },
      { key: "diet", label: "Follow your diet", hint: "no cheat meals, no alcohol" },
      { key: "water", label: "Drink a gallon of water", hint: "about 3.8 L" },
      { key: "read", label: "Read 10 pages", hint: "non-fiction" },
      { key: "photo", label: "Progress photo", hint: "every single day" },
    ],
  },
  {
    id: "75soft",
    name: "75 Soft",
    lengthDays: 75,
    blurb: "Sustainable discipline: still hard, just human.",
    tasks: [
      { key: "diet", label: "Eat well", hint: "only drink on social occasions" },
      { key: "workout", label: "Train 45 min", hint: "one day a week can be active recovery" },
      { key: "water", label: "Drink 3 L of water" },
      { key: "read", label: "Read 10 pages", hint: "any book" },
    ],
  },
];

/** Build a stable, schema-valid key for a custom task label. */
export function taskKey(label: string, taken: Iterable<string>): string {
  const base =
    label.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 20) ||
    "task";
  const used = new Set(taken);
  let key = base;
  for (let i = 2; used.has(key); i++) key = `${base}_${i}`;
  return key;
}
