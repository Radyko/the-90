// Typed client for the backend. Every game write is an RPC in supabase/schema.sql;
// tables are read directly (RLS decides what's visible).

import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type {
  BoardRow,
  Clan,
  ClanEvent,
  ClanPreview,
  LeaderboardRow,
  Member,
  Membership,
  MyStats,
  Persona,
  Profile,
  Task,
} from "./types";

// ─── Errors ─────────────────────────────────────────────────────────────────

/** Codes raised by the schema's RPCs and guards. */
export type GameErrorCode =
  | "not_authenticated" | "no_profile" | "bad_persona" | "gear_locked"
  | "timezone_change_too_soon" | "bad_tasks" | "too_many_clans" | "invalid_invite"
  | "clan_full" | "not_leader" | "not_a_member" | "use_leave_clan" | "unknown_task"
  | "already_finished" | "cannot_stoke_self" | "already_done_today" | "already_stoked";

const MESSAGES: Record<GameErrorCode, string> = {
  not_authenticated: "Please sign in again.",
  no_profile: "Set up your profile first.",
  bad_persona: "That flame style isn't valid.",
  gear_locked: "You haven't unlocked that gear yet.",
  timezone_change_too_soon: "You can only change time zones once every 12 hours.",
  bad_tasks: "Each challenge needs 1–10 tasks with a name.",
  too_many_clans: "You're already in the maximum of 5 clans.",
  invalid_invite: "That invite link isn't valid anymore. Ask for a new one.",
  clan_full: "That clan is full.",
  not_leader: "Only the clan leader can do that.",
  not_a_member: "You're not an active member of this clan.",
  use_leave_clan: "Use “Leave clan” to remove yourself.",
  unknown_task: "That task isn't part of this challenge.",
  already_finished: "You've finished this challenge. It's locked in.",
  cannot_stoke_self: "You can't stoke your own flame.",
  already_done_today: "They've already finished today.",
  already_stoked: "You already stoked them today.",
};

export class GameError extends Error {
  constructor(public code: GameErrorCode | "unknown", message: string) {
    super(message);
  }
}

function toGameError(e: { message: string }): GameError {
  const code = (Object.keys(MESSAGES) as GameErrorCode[]).find((c) => e.message.includes(c));
  return code ? new GameError(code, MESSAGES[code]) : new GameError("unknown", e.message);
}

function db() {
  if (!supabase) throw new GameError("unknown", "Supabase is not configured.");
  return supabase;
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().rpc(fn, args);
  if (error) throw toGameError(error);
  return data as T;
}

async function query<T>(q: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await q;
  if (error) throw toGameError(error);
  return data as T;
}

// ─── Time ───────────────────────────────────────────────────────────────────

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

// ─── Profile ────────────────────────────────────────────────────────────────

export async function getMyProfile(userId: string): Promise<Profile | null> {
  return query(db().from("profiles").select("*").eq("id", userId).maybeSingle());
}

export async function createProfile(userId: string, displayName: string, persona: Persona): Promise<Profile> {
  return query(
    db().from("profiles")
      .insert({ id: userId, display_name: displayName, persona, timezone: browserTimezone() })
      .select().single(),
  );
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<Profile, "display_name" | "persona" | "timezone">>,
): Promise<Profile> {
  return query(db().from("profiles").update(patch).eq("id", userId).select().single());
}

export const myStats = async () => (await rpc<MyStats[]>("my_stats"))[0];

export const deleteAccount = () => rpc<void>("delete_account");

// ─── Playing ────────────────────────────────────────────────────────────────

/** Judge my ended days now (deaths apply immediately). Call on app open. */
export const syncMe = () => rpc<void>("sync_me");

export const checkTask = (clanId: string, key: string, done: boolean) =>
  rpc<Member>("check_task", { p_clan: clanId, p_key: key, p_done: done });

export const selfReportFail = (clanId: string) => rpc<void>("self_report_fail", { p_clan: clanId });

export const stoke = (clanId: string, targetUserId: string) =>
  rpc<void>("stoke", { p_clan: clanId, p_target: targetUserId });

// ─── Clans ──────────────────────────────────────────────────────────────────

/** My memberships (active and pending) with their clan. */
export async function myMemberships(userId: string): Promise<Membership[]> {
  return query(
    db().from("clan_members").select("*, clan:clans(*)")
      .eq("user_id", userId).order("requested_at"),
  );
}

export const createClan = (args: {
  name: string; challengeName: string; lengthDays: number; tasks: Task[]; isPublic?: boolean;
}) =>
  rpc<Clan>("create_clan", {
    p_name: args.name,
    p_challenge_name: args.challengeName,
    p_length_days: args.lengthDays,
    p_tasks: args.tasks,
    p_is_public: args.isPublic ?? true,
  });

export const previewClan = async (code: string) =>
  (await rpc<ClanPreview[]>("preview_clan", { p_code: code }))[0] ?? null;

export const requestJoin = (code: string) => rpc<string>("request_join", { p_code: code });

export const leaveClan = (clanId: string) => rpc<void>("leave_clan", { p_clan: clanId });

export const clanBoard = (clanId: string) => rpc<BoardRow[]>("clan_board", { p_clan: clanId });

export async function clanEvents(clanId: string, limit = 50): Promise<ClanEvent[]> {
  return query(
    db().from("clan_events").select("*").eq("clan_id", clanId)
      .order("created_at", { ascending: false }).limit(limit),
  );
}

export const leaderboard = (limit = 50) => rpc<LeaderboardRow[]>("clan_leaderboard", { p_limit: limit });

// ─── Leader tools ───────────────────────────────────────────────────────────

export const respondRequest = (clanId: string, userId: string, accept: boolean) =>
  rpc<void>("respond_request", { p_clan: clanId, p_user: userId, p_accept: accept });

export const updateClan = (clanId: string, patch: { name?: string; isPublic?: boolean }) =>
  rpc<Clan>("update_clan", { p_clan: clanId, p_name: patch.name ?? null, p_is_public: patch.isPublic ?? null });

export const rotateInvite = (clanId: string) => rpc<string>("rotate_invite", { p_clan: clanId });

export const removeMember = (clanId: string, userId: string) =>
  rpc<void>("remove_member", { p_clan: clanId, p_user: userId });

export const transferLeadership = (clanId: string, userId: string) =>
  rpc<void>("transfer_leadership", { p_clan: clanId, p_user: userId });

export function inviteUrl(code: string, origin = window.location.origin): string {
  return `${origin}/?join=${code}`;
}

// ─── Realtime ───────────────────────────────────────────────────────────────

/**
 * Calls onChange whenever anything on the clan's board or feed changes
 * (check-ins, deaths, joins, stokes). Returns an unsubscribe function.
 */
export function subscribeToClan(clanId: string, onChange: () => void): () => void {
  const client = db();
  const channel: RealtimeChannel = client
    .channel(`clan:${clanId}`)
    .on("postgres_changes",
        { event: "*", schema: "public", table: "clan_members", filter: `clan_id=eq.${clanId}` },
        onChange)
    .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "clan_events", filter: `clan_id=eq.${clanId}` },
        onChange)
    .subscribe();
  return () => {
    client.removeChannel(channel);
  };
}

/** Fires when my own membership changes, e.g. a pending request gets approved. */
export function subscribeToMe(userId: string, onChange: () => void): () => void {
  const client = db();
  const channel = client
    .channel(`me:${userId}`)
    .on("postgres_changes",
        { event: "*", schema: "public", table: "clan_members", filter: `user_id=eq.${userId}` },
        onChange)
    .subscribe();
  return () => {
    client.removeChannel(channel);
  };
}
