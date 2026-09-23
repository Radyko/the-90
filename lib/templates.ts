// Challenge templates for "New clan". Display names live here only, so "75 Hard" (a trademark) is a one-line change.
import type { Task } from './types';


export interface Template { id: 'hard75' | 'soft75' | 'the90' | 'custom'; name: string; length_days: number; tasks: Task[] }

export const TEMPLATES: Template[] = [
  { id: 'the90', name: 'The 90', length_days: 90, tasks: [
    { key: 'phone_free', label: 'Phone-free first hour', hint: 'No phone until your morning block is done' },
    { key: 'move', label: 'Move your body', hint: '30–60 min: run, lift, or walk; it has to count' },
    { key: 'deep_work', label: 'Deep work block', hint: 'One focused session: coursework, research, reading; your call' },
    { key: 'build', label: 'Career / build block', hint: '30–60 min: LeetCode, startup, or learning something new' },
  ] },
  { id: 'hard75', name: '75 Hard', length_days: 75, tasks: [
    { key: 'workouts', label: 'Two 45-min workouts', hint: 'One of them outdoors' },
    { key: 'diet', label: 'Follow your diet', hint: 'No cheat meals, no alcohol' },
    { key: 'water', label: 'Drink a gallon of water' },
    { key: 'read', label: 'Read 10 pages', hint: 'Non-fiction' },
    { key: 'photo', label: 'Take a progress photo' },
  ] },
  { id: 'soft75', name: '75 Soft', length_days: 75, tasks: [
    { key: 'eat', label: 'Eat well', hint: 'Drink only socially' },
    { key: 'workout', label: '45-min workout', hint: 'One day a week can be active recovery' },
    { key: 'water', label: 'Drink 3 L of water' },
    { key: 'read', label: 'Read 10 pages' },
  ] },
  { id: 'custom', name: 'Custom', length_days: 30, tasks: [] },
];

/** Build a stable, schema-valid key (^[a-z0-9_]{1,24}$) for a custom task label. */
export function taskKey(label: string, taken: Iterable<string>): string {
  const base =
    label.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 20) || 'task';
  const used = new Set(taken);
  let key = base;
  for (let i = 2; used.has(key); i++) key = `${base}_${i}`;
  return key;
}
