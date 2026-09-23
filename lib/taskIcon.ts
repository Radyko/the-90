// Tasks have no icon field in the backend. Pick one from the label (EN keywords; falls back to a check).
// Keep this client-side and cheap; custom clans get sensible icons without a schema change.
import type { IconName } from '@/components/Icon';

const RULES: [RegExp, IconName][] = [
  [/phone|screen|social/i, 'phone'],
  [/workout|move|run|lift|walk|gym|train|exercise/i, 'move'],
  [/read|page|book|study|deep work|course/i, 'book'],
  [/code|leetcode|build|career|startup|learn/i, 'code'],
  [/water|drink|gallon|litre|liter/i, 'water'],
  [/diet|eat|meal|food|alcohol|sugar/i, 'food'],
  [/photo|picture|selfie/i, 'camera'],
];

export const taskIcon = (label: string): IconName => RULES.find(([re]) => re.test(label))?.[1] ?? 'task';
