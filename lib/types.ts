// Row and RPC result shapes. Source of truth: supabase/schema.sql.

export type Eyes = "round" | "sharp" | "sleepy" | "happy";
export type Gear = "none" | "headband" | "horns" | "crown";
export type Stage = "spark" | "flame" | "blaze" | "inferno" | "phoenix";
export type ClanTheme = "sunset" | "campfire" | "forest" | "lake" | "berry" | "sand";
export const CLAN_THEMES: ClanTheme[] = ["sunset", "campfire", "forest", "lake", "berry", "sand"];

export type Persona = {
  hue?: number; // 0–359
  eyes?: Eyes;
  gear?: Gear; // must be unlocked (see MyStats.unlocked_gear)
};

export type Profile = {
  id: string;
  display_name: string;
  persona: Persona;
  timezone: string; // IANA zone; changeable at most once per 12h
  timezone_changed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Task = { key: string; label: string; hint?: string };

export type Clan = {
  id: string;
  name: string;
  challenge_name: string;
  length_days: number;
  tasks: Task[];
  invite_code: string;
  is_public: boolean;
  max_members: number;
  theme: ClanTheme;
  created_by: string | null;
  created_at: string;
};

export type Member = {
  clan_id: string;
  user_id: string;
  role: "leader" | "member";
  status: "pending" | "active";
  start_date: string; // YYYY-MM-DD, member's local calendar
  attempt: number;
  deaths: number;
  best_run: number;
  log: Record<string, Record<string, boolean>>; // { date: { taskKey: done } }
  finished_at: string | null;
  last_evaluated: string | null;
  requested_at: string;
  joined_at: string | null;
  updated_at: string;
};

export type Membership = Member & { clan: Clan };

export type ClanEvent = {
  id: number;
  clan_id: string;
  user_id: string | null; // the actor
  created_at: string;
} & (
  | { kind: "joined"; day: 1; meta: Record<string, never> }
  | { kind: "left"; day: null; meta: { removed?: boolean } }
  | { kind: "day_complete" | "milestone"; day: number; meta: { attempt: number } }
  | { kind: "died"; day: number; meta: { attempt: number; reason: "midnight" | "rule"; missed: number } } // day = days survived
  | { kind: "finished"; day: number; meta: { attempt: number } }
  | { kind: "stoke"; day: null; meta: { target: string } }
);

export type EventKind = ClanEvent["kind"];

/** One row of clan_board(): derived per-member state, computed server-side. */
export type BoardRow = {
  user_id: string;
  display_name: string | null;
  persona: Persona;
  role: "leader" | "member";
  status: "pending" | "active"; // pending rows are returned to the leader only
  day: number; // current day number, 1…length_days
  length_days: number;
  tasks_done: number; // today
  tasks_total: number;
  done_today: boolean;
  stage: Stage;
  attempt: number;
  deaths: number;
  best_run: number;
  finished: boolean;
  today: string; // YYYY-MM-DD in that member's zone
};

export type MyStats = {
  best_run: number;
  deaths: number;
  finished: number;
  clans: number;
  unlocked_gear: Gear[];
};

export type LeaderboardRow = {
  clan_id: string;
  name: string;
  challenge_name: string;
  members: number;
  alive_today: number;
  avg_run: number;
  is_mine: boolean;
};

export type ClanPreview = {
  id: string;
  name: string;
  challenge_name: string;
  length_days: number;
  tasks: Task[];
  theme: ClanTheme;
  members: number;
  max_members: number;
  my_status: "pending" | "active" | null;
};
