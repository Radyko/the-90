import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Both values are public by design. Security is enforced by RLS in supabase/schema.sql.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isConfigured = Boolean(url && anonKey);

// Browser-only client. Null when env vars are missing so the app can render a setup
// notice instead of crashing (and so `next build` works without credentials).
export const supabase: SupabaseClient | null = isConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Implicit flow lets a magic link requested on a laptop be opened on a phone.
        // PKCE would require the same browser that requested it.
        flowType: "implicit",
      },
    })
  : null;

// ─── The daily four ─────────────────────────────────────────────────────────
// These keys are stored in participants.log. Do NOT rename without a DB migration.
export const TASK_KEYS = ["phone", "move", "deep", "build"] as const;
export type TaskKey = (typeof TASK_KEYS)[number];

export const TASKS: { key: TaskKey; label: string; hint: string }[] = [
  { key: "phone", label: "Phone-free first hour", hint: "no phone until your morning block is done" },
  { key: "move", label: "Move your body", hint: "30–60 min — run, lift, or walk; it has to count" },
  { key: "deep", label: "Deep work block", hint: "one focused session — coursework, research, reading; your call" },
  { key: "build", label: "Career / build block", hint: "30–60 min — LeetCode, startup, or learning something new" },
];

export type DayLog = Partial<Record<TaskKey, boolean>>;

export type Participant = {
  id: string;
  board_id: string;
  user_id: string;
  display_name: string | null;
  start_date: string; // YYYY-MM-DD, owner's local calendar
  attempt: number;
  log: Record<string, DayLog>;
  timezone: string; // IANA zone
  created_at: string;
  updated_at: string;
};

export type Board = {
  id: string;
  name: string | null;
  invite_code: string;
  max_members: number;
  created_by: string | null;
  created_at: string;
};

// ─── Dates ──────────────────────────────────────────────────────────────────
// All "days" are local calendar days (YYYY-MM-DD) in a given IANA zone, never UTC.

export const TOTAL_DAYS = 90;

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function todayIn(timezone: string, now: Date = new Date()): string {
  try {
    // en-CA formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return new Intl.DateTimeFormat("en-CA").format(now);
  }
}

function toUtcMs(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function daysBetween(fromYmd: string, toYmd: string): number {
  return Math.round((toUtcMs(toYmd) - toUtcMs(fromYmd)) / 86_400_000);
}

export function addDays(ymd: string, n: number): string {
  return new Date(toUtcMs(ymd) + n * 86_400_000).toISOString().slice(0, 10);
}

export function isDayComplete(day: DayLog | undefined): boolean {
  return !!day && TASK_KEYS.every((k) => day[k] === true);
}
