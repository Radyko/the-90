"use client";
// App-wide state: session, profile, memberships, active clan (+ its theme), stats, toasts.
// Everything stays live: auth changes, my membership changes (realtime) and tab re-focus.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  browserTimezone, getMyProfile, myMemberships, myStats, subscribeToMe, syncMe, updateProfile,
} from "@/lib/api";
import type { Membership, MyStats, Profile } from "@/lib/types";
import { store } from "@/lib/store";

type Toast = { id: number; kind: "success" | "error" | "info"; text: string };

type AppState = {
  session: Session | null | undefined; // undefined = still loading
  profile: Profile | null | undefined;
  memberships: Membership[] | undefined;
  stats: MyStats | null;
  active: Membership | null; // the clan currently shown (active or pending)
  setActiveClan: (clanId: string) => void;
  setProfile: (p: Profile) => void;
  refresh: () => Promise<void>;
  toast: (text: string, kind?: Toast["kind"]) => void;
};

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp outside AppProvider");
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [memberships, setMemberships] = useState<Membership[] | undefined>(undefined);
  const [stats, setStats] = useState<MyStats | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const uid = session?.user.id;

  useEffect(() => {
    if (!supabase) {
      setSession(null);
      return;
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const toast = useCallback((text: string, kind: Toast["kind"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts, { id, kind, text }]);
    if (kind !== "error") setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 3500);
  }, []);

  const refresh = useCallback(async () => {
    if (!uid) return;
    try {
      await syncMe(); // judge ended days first, so deaths show up immediately
      const [p, ms, st] = await Promise.all([getMyProfile(uid), myMemberships(uid), myStats()]);
      setProfile(p);
      setMemberships(ms);
      setStats(st ?? null);
      // Follow the phone's time zone (server rate-limits and judges the old zone first).
      if (p && p.timezone !== browserTimezone()) {
        updateProfile(uid, { timezone: browserTimezone() }).then(setProfile).catch(() => {});
      }
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }, [uid, toast]);

  const signedOut = session === null;
  useEffect(() => {
    if (!signedOut) return;
    setProfile(null);
    setMemberships([]);
    setStats(null);
  }, [signedOut]);

  useEffect(() => {
    if (!uid) return;
    refresh();
    const unsubscribe = subscribeToMe(uid, refresh);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [uid, refresh]);

  // Active clan: explicit choice → remembered choice → first active → first pending.
  const active = useMemo(() => {
    if (!memberships?.length) return null;
    const wanted = activeId ?? store.get("activeClan");
    return (
      memberships.find((m) => m.clan_id === wanted) ??
      memberships.find((m) => m.status === "active") ??
      memberships[0]
    );
  }, [memberships, activeId]);

  const setActiveClan = useCallback((clanId: string) => {
    setActiveId(clanId);
    store.set("activeClan", clanId);
  }, []);

  // The active clan's theme colors the whole app.
  useEffect(() => {
    document.documentElement.dataset.theme = active?.clan.theme ?? "sunset";
  }, [active?.clan.theme]);

  const value = useMemo<AppState>(
    () => ({ session, profile, memberships, stats, active, setActiveClan, setProfile, refresh, toast }),
    [session, profile, memberships, stats, active, setActiveClan, refresh, toast],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((x) => (
          <div key={x.id} className={`toast toast--${x.kind}`} role={x.kind === "error" ? "alert" : "status"}
               onClick={() => setToasts((ts) => ts.filter((y) => y.id !== x.id))}>
            {x.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

/**
 * Route guard for signed-in screens. Sends people to the step they're missing:
 * sign in → set up profile → accept a pending invite → have a clan.
 * Returns true once the screen can render.
 */
export function useGate(needs: "session" | "profile" | "clan" = "clan"): boolean {
  const { session, profile, memberships } = useApp();
  const router = useRouter();
  const path = usePathname();
  const target = useRef<string | null>(null);

  let go: string | null = null;
  if (session === null) go = "/signin";
  else if (session && needs !== "session" && profile === null) go = "/setup";
  else if (profile && needs === "clan" && memberships && memberships.length === 0) {
    const invite = store.get("pendingJoin");
    go = invite ? `/j/${invite}` : "/start";
  }

  useEffect(() => {
    if (go && go !== path && target.current !== go) {
      target.current = go;
      router.replace(go);
    }
  }, [go, path, router]);

  const loaded =
    session !== undefined &&
    (needs === "session" || profile !== undefined) &&
    (needs !== "clan" || memberships !== undefined);
  return loaded && !go;
}
