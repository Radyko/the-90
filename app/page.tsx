"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  supabase,
  isConfigured,
  TASKS,
  TOTAL_DAYS,
  addDays,
  browserTimezone,
  daysBetween,
  isDayComplete,
  todayIn,
  type Board,
  type DayLog,
  type Participant,
  type TaskKey,
} from "@/lib/supabase";

const ACCENTS = ["#6C7A5B", "#8A6A52", "#5B6E7A", "#7A5B72", "#7A735B", "#5B7A6E"];
const PENDING_JOIN_KEY = "the90.pendingJoin";
const ACTIVE_BOARD_KEY = "the90.activeBoard";
// Keep ~a year of history per row; the DB also caps log size.
const LOG_RETENTION_DAYS = 400;

const STANDING_RULES = [
  "No desserts",
  "No social media / short-form",
  "Phone cleaned out — LinkedIn, Gmail, IG, FB, YouTube off the device",
];

// ─── storage helpers (never throw) ──────────────────────────────────────────

function readStore(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStore(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* private mode etc. */
  }
}

function friendlyError(message: string): string {
  if (message.includes("invalid_invite")) return "That invite link isn't valid. Ask your friend to send it again.";
  if (message.includes("board_full")) return "That board is already full.";
  if (message.includes("too_many_boards")) return "You're already on the maximum number of boards.";
  if (message.includes("bad_start_date")) return "Your device clock looks off. Check the date and try again.";
  return message;
}

// ─── Root: auth gate ────────────────────────────────────────────────────────

export default function Home() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [pendingJoin, setPendingJoin] = useState<string | null>(null);

  useEffect(() => {
    // Capture an invite code from ?join=… and keep it across the magic-link round trip.
    const code = new URLSearchParams(window.location.search).get("join");
    if (code && /^[a-f0-9]{8,64}$/i.test(code)) writeStore(PENDING_JOIN_KEY, code);
    setPendingJoin(readStore(PENDING_JOIN_KEY));

    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const clearPendingJoin = useCallback(() => {
    writeStore(PENDING_JOIN_KEY, null);
    setPendingJoin(null);
    const url = new URL(window.location.href);
    if (url.searchParams.has("join")) {
      url.searchParams.delete("join");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
  }, []);

  if (!isConfigured) return <SetupNotice />;
  if (session === undefined) return <main className="shell"><p className="quiet">Loading…</p></main>;
  if (!session) return <SignIn pendingJoin={pendingJoin} />;
  return <App session={session} pendingJoin={pendingJoin} clearPendingJoin={clearPendingJoin} />;
}

function SetupNotice() {
  return (
    <main className="shell narrow">
      <h1 className="title">The 90</h1>
      <p className="lede">
        Supabase isn&apos;t configured yet. Fill in <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in <code>.env.local</code>, then restart the dev server.
      </p>
    </main>
  );
}

// ─── Sign in ────────────────────────────────────────────────────────────────

function SignIn({ pendingJoin }: { pendingJoin: string | null }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || state === "sending") return;
    setState("sending");
    setError(null);
    // Carry the invite code in the redirect too, so it survives opening the link on another device.
    const redirect = window.location.origin + (pendingJoin ? `/?join=${encodeURIComponent(pendingJoin)}` : "");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirect },
    });
    if (error) {
      setError(error.message);
      setState("idle");
    } else {
      setState("sent");
    }
  }

  return (
    <main className="shell narrow">
      <h1 className="title">The 90</h1>
      <p className="lede">
        Ninety days. Four non-negotiables a day. Miss one and you call your own restart.
      </p>
      {pendingJoin && state !== "sent" && (
        <p className="notice">You&apos;ve been invited to a board. Sign in to take your lane.</p>
      )}
      {state === "sent" ? (
        <div className="sent" role="status">
          <p className="sent-head">Check your email.</p>
          <p className="quiet">
            We sent a sign-in link to <strong>{email.trim()}</strong>. Open it on this device or any other.
          </p>
          <button className="linklike" onClick={() => setState("idle")}>Use a different email</button>
        </div>
      ) : (
        <form className="signin" onSubmit={submit}>
          <label htmlFor="email" className="label">Email</label>
          <div className="signin-row">
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit" className="btn" disabled={state === "sending"}>
              {state === "sending" ? "Sending…" : "Email me a sign-in link"}
            </button>
          </div>
          {error && <p className="error" role="alert">{error}</p>}
        </form>
      )}
    </main>
  );
}

// ─── Signed-in app ──────────────────────────────────────────────────────────

function App({
  session,
  pendingJoin,
  clearPendingJoin,
}: {
  session: Session;
  pendingJoin: string | null;
  clearPendingJoin: () => void;
}) {
  const uid = session.user.id;
  const email = session.user.email ?? "";
  const [boardIds, setBoardIds] = useState<string[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadMemberships = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("participants")
      .select("board_id, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: true });
    if (error) {
      setLoadError(error.message);
      return;
    }
    const ids = (data ?? []).map((r) => r.board_id as string);
    setBoardIds(ids);
    setActiveId((cur) => {
      if (cur && ids.includes(cur)) return cur;
      const saved = readStore(ACTIVE_BOARD_KEY);
      return saved && ids.includes(saved) ? saved : ids[0] ?? null;
    });
  }, [uid]);

  useEffect(() => {
    loadMemberships();
  }, [loadMemberships]);

  useEffect(() => {
    if (activeId) writeStore(ACTIVE_BOARD_KEY, activeId);
  }, [activeId]);

  const onBoardReady = useCallback(
    async (boardId: string) => {
      clearPendingJoin();
      await loadMemberships();
      setActiveId(boardId);
    },
    [clearPendingJoin, loadMemberships],
  );

  let content: React.ReactNode;
  if (loadError) content = <p className="error" role="alert">{loadError}</p>;
  else if (boardIds === null) content = <p className="quiet">Loading your board…</p>;
  else if (pendingJoin) content = <JoinBoard code={pendingJoin} email={email} onDone={onBoardReady} onDismiss={clearPendingJoin} />;
  else if (!activeId) content = <NewBoard email={email} onDone={onBoardReady} />;
  else content = <BoardView key={activeId} boardId={activeId} uid={uid} email={email} />;

  return (
    <main className="shell">
      <header className="topbar">
        <span className="topbar-email" title={email}>{email}</span>
        {boardIds && boardIds.length > 1 && !pendingJoin && (
          <select
            className="board-switch"
            aria-label="Switch board"
            value={activeId ?? ""}
            onChange={(e) => setActiveId(e.target.value)}
          >
            {boardIds.map((id, i) => (
              <option key={id} value={id}>Board {i + 1}</option>
            ))}
          </select>
        )}
        <button className="linklike" onClick={() => supabase?.auth.signOut()}>Sign out</button>
      </header>
      <Masthead />
      {content}
    </main>
  );
}

function Masthead() {
  return (
    <section className="masthead">
      <h1 className="title">The 90</h1>
      <p className="lede">
        Four non-negotiables, every day, for ninety days. Miss even one and you restart at Day 1 — your call, on your honor.
      </p>
      <ul className="pills" aria-label="Standing rules">
        {STANDING_RULES.map((r) => (
          <li key={r} className="pill">{r}</li>
        ))}
      </ul>
    </section>
  );
}

// ─── Start / join ───────────────────────────────────────────────────────────

function StartForm({
  email,
  cta,
  onSubmit,
}: {
  email: string;
  cta: string;
  onSubmit: (displayName: string) => Promise<string | null>;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const err = await onSubmit(name.trim());
    if (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  return (
    <form className="start" onSubmit={submit}>
      <label htmlFor="display-name" className="label">Display name <span className="quiet">(optional)</span></label>
      <input
        id="display-name"
        maxLength={40}
        placeholder={email.split("@")[0]}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button type="submit" className="btn btn-big" disabled={busy}>{busy ? "Starting…" : cta}</button>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}

function NewBoard({ email, onDone }: { email: string; onDone: (boardId: string) => void }) {
  return (
    <div className="lanes">
      <section className="lane">
        <LaneHead name={email.split("@")[0]} tag="your lane" accent={ACCENTS[0]} />
        <p className="quiet">Your 90 starts the day you say so.</p>
        <StartForm
          email={email}
          cta="Start Day 1"
          onSubmit={async (displayName) => {
            if (!supabase) return "Not configured";
            const tz = browserTimezone();
            const { data, error } = await supabase.rpc("create_board", {
              p_display_name: displayName,
              p_start_date: todayIn(tz),
              p_timezone: tz,
            });
            if (error) return error.message;
            onDone((data as Board).id);
            return null;
          }}
        />
      </section>
      <section className="lane lane-empty">
        <p className="empty-head">Your friend&apos;s lane</p>
        <p className="quiet">Start Day 1 and you&apos;ll get an invite link to send them.</p>
      </section>
    </div>
  );
}

function JoinBoard({
  code,
  email,
  onDone,
  onDismiss,
}: {
  code: string;
  email: string;
  onDone: (boardId: string) => void;
  onDismiss: () => void;
}) {
  return (
    <div className="lanes">
      <section className="lane">
        <LaneHead name={email.split("@")[0]} tag="your lane" accent={ACCENTS[1]} />
        <p className="quiet">You&apos;ve been invited. Take the other lane and start your Day 1.</p>
        <StartForm
          email={email}
          cta="Join & start Day 1"
          onSubmit={async (displayName) => {
            if (!supabase) return "Not configured";
            const tz = browserTimezone();
            const { data, error } = await supabase.rpc("join_board", {
              p_invite_code: code,
              p_display_name: displayName,
              p_start_date: todayIn(tz),
              p_timezone: tz,
            });
            if (error) return error.message;
            onDone((data as Board).id);
            return null;
          }}
        />
        <button className="linklike" onClick={onDismiss}>Ignore invite</button>
      </section>
    </div>
  );
}

// ─── Board ──────────────────────────────────────────────────────────────────

function BoardView({ boardId, uid, email }: { boardId: string; uid: string; email: string }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [people, setPeople] = useState<Participant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const [now, setNow] = useState(() => new Date());

  const refetch = useCallback(async () => {
    if (!supabase) return;
    const [b, p] = await Promise.all([
      supabase.from("boards").select("*").eq("id", boardId).single(),
      supabase.from("participants").select("*").eq("board_id", boardId),
    ]);
    if (b.error || p.error) {
      setError((b.error ?? p.error)!.message);
      return;
    }
    setBoard(b.data as Board);
    // While a write is in flight, don't let a stale refetch clobber the optimistic state.
    if (!inFlight.current) setPeople(p.data as Participant[]);
  }, [boardId]);

  // Initial load + realtime: refetch on any change to this board's participants.
  useEffect(() => {
    if (!supabase) return;
    refetch();
    const client = supabase;
    const channel = client
      .channel(`board:${boardId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participants", filter: `board_id=eq.${boardId}` },
        () => refetch(),
      )
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [boardId, refetch]);

  // Roll over at midnight, and catch up after the tab was backgrounded.
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setNow(new Date());
        refetch();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refetch]);

  const me = people?.find((p) => p.user_id === uid) ?? null;
  const others = (people ?? []).filter((p) => p.user_id !== uid);

  const accentFor = useMemo(() => {
    const sorted = [...(people ?? [])].map((p) => p.user_id).sort();
    return (userId: string) => ACCENTS[Math.max(0, sorted.indexOf(userId)) % ACCENTS.length];
  }, [people]);

  // One write at a time, only ever to my own row.
  const writeOwn = useCallback(
    async (patch: Partial<Pick<Participant, "log" | "start_date" | "attempt" | "timezone" | "display_name">>) => {
      if (!supabase || !me || inFlight.current) return;
      inFlight.current = true;
      setSaving(true);
      setError(null);
      const optimistic = { ...me, ...patch };
      setPeople((cur) => cur?.map((p) => (p.id === me.id ? optimistic : p)) ?? cur);
      const { error } = await supabase
        .from("participants")
        .update(patch)
        .eq("id", me.id)
        .eq("user_id", uid);
      inFlight.current = false;
      setSaving(false);
      if (error) setError(error.message);
      refetch();
    },
    [me, uid, refetch],
  );

  const myTz = browserTimezone();

  const toggle = useCallback(
    (key: TaskKey) => {
      if (!me) return;
      const today = todayIn(myTz);
      const cutoff = addDays(today, -LOG_RETENTION_DAYS);
      const log: Record<string, DayLog> = {};
      for (const [d, v] of Object.entries(me.log ?? {})) if (d >= cutoff) log[d] = v;
      log[today] = { ...log[today], [key]: !log[today]?.[key] };
      writeOwn({ log, ...(me.timezone !== myTz ? { timezone: myTz } : {}) });
    },
    [me, myTz, writeOwn],
  );

  const restart = useCallback(() => {
    if (!me) return;
    const today = todayIn(myTz);
    const log = { ...(me.log ?? {}) };
    delete log[today];
    writeOwn({ start_date: today, attempt: me.attempt + 1, log, timezone: myTz });
  }, [me, myTz, writeOwn]);

  if (error && !people) return <p className="error" role="alert">{error}</p>;
  if (!people || !board) return <p className="quiet">Loading your board…</p>;

  const inviteUrl = `${window.location.origin}/?join=${board.invite_code}`;
  const openSeats = board.max_members - people.length;

  return (
    <>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="lanes">
        {me && (
          <Lane
            p={me}
            isMe
            name={me.display_name || email.split("@")[0]}
            accent={accentFor(me.user_id)}
            timezone={myTz}
            now={now}
            saving={saving}
            onToggle={toggle}
            onRestart={restart}
          />
        )}
        {others.map((p) => (
          <Lane
            key={p.id}
            p={p}
            isMe={false}
            name={p.display_name || "Your friend"}
            accent={accentFor(p.user_id)}
            timezone={p.timezone}
            now={now}
          />
        ))}
        {openSeats > 0 && <WaitingLane inviteUrl={inviteUrl} />}
      </div>
    </>
  );
}

function WaitingLane({ inviteUrl }: { inviteUrl: string }) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked; the link is visible to copy by hand */
    }
  }

  return (
    <section className="lane lane-empty" aria-live="polite">
      <p className="empty-head">Waiting for your friend — send them the link</p>
      <p className="quiet">Their lane lights up here the moment they join.</p>
      <div className="invite">
        <input readOnly value={inviteUrl} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} />
        <button className="btn" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
        {canShare && (
          <button
            className="btn btn-ghost"
            onClick={() => navigator.share({ title: "The 90", text: "Race me to 90.", url: inviteUrl }).catch(() => {})}
          >
            Share
          </button>
        )}
      </div>
    </section>
  );
}

// ─── Lane ───────────────────────────────────────────────────────────────────

function LaneHead({ name, tag, accent }: { name: string; tag: string; accent: string }) {
  return (
    <div className="lane-head">
      <span className="avatar" style={{ background: accent }} aria-hidden="true">
        {(name.trim()[0] ?? "?").toUpperCase()}
      </span>
      <span className="lane-name">{name}</span>
      <span className="lane-tag">{tag}</span>
    </div>
  );
}

function Lane({
  p,
  isMe,
  name,
  accent,
  timezone,
  now,
  saving = false,
  onToggle,
  onRestart,
}: {
  p: Participant;
  isMe: boolean;
  name: string;
  accent: string;
  timezone: string;
  now: Date;
  saving?: boolean;
  onToggle?: (key: TaskKey) => void;
  onRestart?: () => void;
}) {
  const today = todayIn(timezone, now);
  const elapsed = Math.max(0, daysBetween(p.start_date, today)); // 0-based index of today
  const dayN = Math.min(elapsed + 1, TOTAL_DAYS);
  const todayLog = p.log?.[today];
  const todayComplete = isDayComplete(todayLog);
  const finished = elapsed + 1 > TOTAL_DAYS || (elapsed + 1 === TOTAL_DAYS && todayComplete);
  const doneCount = TASKS.filter((t) => todayLog?.[t.key]).length;

  // The one motion moment: pulse today's cell when it fills during this session.
  const prevComplete = useRef<boolean | null>(null);
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (prevComplete.current === false && todayComplete) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 900);
      prevComplete.current = todayComplete;
      return () => clearTimeout(t);
    }
    prevComplete.current = todayComplete;
  }, [todayComplete]);

  const dialogRef = useRef<HTMLDialogElement>(null);

  const status = finished ? "90/90 done" : todayComplete ? "today complete" : `today in progress · ${doneCount}/4`;

  return (
    <section className={`lane${isMe ? " lane-me" : ""}`} style={{ "--accent": accent } as React.CSSProperties}>
      <LaneHead name={name} tag={isMe ? "your lane" : "their lane"} accent={accent} />

      <div className="counter">
        <span className="counter-label">Day</span>
        <span className="counter-num">{dayN}</span>
        <span className="counter-of">of {TOTAL_DAYS}</span>
      </div>
      <p className="status">
        {p.attempt > 1 && <span className="attempt">Attempt #{p.attempt}</span>}
        <span className={todayComplete || finished ? "status-done" : undefined}>{status}</span>
      </p>

      <ol className="track" aria-label={`Progress: day ${dayN} of ${TOTAL_DAYS}`}>
        {Array.from({ length: TOTAL_DAYS }, (_, i) => {
          const date = addDays(p.start_date, i);
          const filled = isDayComplete(p.log?.[date]);
          const current = i === elapsed;
          const cls = ["cell", filled && "filled", current && "current", i > elapsed && "future", current && pulse && "pulse"]
            .filter(Boolean)
            .join(" ");
          return <li key={i} className={cls} title={`Day ${i + 1} · ${date}`} />;
        })}
      </ol>

      <ul className="tasks">
        {TASKS.map((t) => {
          const checked = !!todayLog?.[t.key];
          const id = `${p.id}-${t.key}`;
          return (
            <li key={t.key} className={`task${checked ? " done" : ""}`}>
              <input
                id={id}
                type="checkbox"
                checked={checked}
                disabled={!isMe || saving || finished}
                onChange={() => onToggle?.(t.key)}
              />
              <label htmlFor={id}>
                <span className="task-label">{t.label}</span>
                <span className="task-hint">{t.hint}</span>
              </label>
            </li>
          );
        })}
      </ul>

      {isMe && (
        <footer className="lane-foot">
          <button className="linklike danger" onClick={() => dialogRef.current?.showModal()} disabled={saving}>
            I missed a day — restart to Day 1
          </button>
          <dialog ref={dialogRef} className="confirm" aria-labelledby={`${p.id}-confirm-title`}>
            <form method="dialog">
              <h2 id={`${p.id}-confirm-title`} className="confirm-title">Restart to Day 1?</h2>
              <p>
                This resets you to Day 1 and clears today&apos;s boxes. Your attempt count goes to #{p.attempt + 1}. Your friend will see it.
              </p>
              <div className="confirm-actions">
                <button value="cancel" className="btn btn-ghost" autoFocus>Cancel</button>
                <button value="confirm" className="btn btn-danger" onClick={() => onRestart?.()}>Restart</button>
              </div>
            </form>
          </dialog>
        </footer>
      )}
    </section>
  );
}
