"use client";
// Today (S16–S22): the core loop. Check tasks → the flame stokes → day complete.
// Deaths are decided by the server; this screen shows them once on the next open.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useApp, useGate } from "@/components/AppProvider";
import { AppScreen, Loading } from "@/components/Shell";
import { Flame } from "@/components/Flame";
import { Icon } from "@/components/Icon";
import { TaskTile } from "@/components/TaskTile";
import { WeekStrip, type WeekDotState } from "@/components/WeekStrip";
import { ProgressTrack } from "@/components/ProgressTrack";
import { Sheet } from "@/components/Overlay";
import { HoldButton } from "@/components/HoldButton";
import { checkTask, selfReportFail } from "@/lib/api";
import {
  MILESTONES, currentDay, daysBetween, flameLabel, localDate, moodFor, msToMidnight, scarsFor, stageFor,
} from "@/lib/flame";
import { taskIcon } from "@/lib/taskIcon";
import { useClan } from "@/lib/useClan";
import { store } from "@/lib/store";
import { t } from "@/lib/i18n";
import type { ClanEvent, Member, Membership } from "@/lib/types";

const addDays = (ymd: string, n: number) =>
  new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

function formatLeft(ms: number) {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function Today() {
  const ready = useGate("clan");
  const { active } = useApp();
  if (!ready || !active) return <Loading />;
  if (active.status === "pending") return <PendingClan membership={active} />;
  return <TodayBoard key={active.clan_id} membership={active} />;
}

function PendingClan({ membership }: { membership: Membership }) {
  return (
    <AppScreen>
      <div className="card stack-sm center-flow">
        <h1>{t("join.pendingTitle")}</h1>
        <p className="muted">{t("join.pendingBody", { clan: membership.clan.name })}</p>
        <Link className="btn btn--secondary" href={`/j/${membership.clan.invite_code}`}>{t("join.live")}</Link>
      </div>
    </AppScreen>
  );
}

type Moment = { kind: "death"; event: ClanEvent & { kind: "died" } } | { kind: "relit" } | { kind: "complete"; day: number };

function TodayBoard({ membership }: { membership: Membership }) {
  const { profile, refresh, toast } = useApp();
  const clan = membership.clan;
  const { board, events } = useClan(clan.id);
  const now = useNow();
  const tz = profile?.timezone ?? "UTC";
  const persona = profile?.persona ?? {};
  const hue = persona.hue ?? 18;

  // My row: server truth, overlaid with in-flight optimistic checks.
  const [member, setMember] = useState<Member>(membership);
  useEffect(() => setMember(membership), [membership]);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [stoke, setStoke] = useState(0);
  const queue = useRef(Promise.resolve());

  const today = localDate(tz, now);
  const log = { ...(member.log[today] ?? {}), ...pending };
  const done = clan.tasks.map((task) => !!log[task.key]);
  const doneCount = done.filter(Boolean).length;
  const total = clan.tasks.length;
  const complete = doneCount === total;
  const finished = !!member.finished_at;
  const day = finished ? clan.length_days : Math.min(clan.length_days, Math.max(1, currentDay(member, tz, now)));
  const streak = finished ? clan.length_days : day - 1 + (complete ? 1 : 0);
  const msLeft = msToMidnight(tz, now);
  const mood = finished ? "full" : moodFor(doneCount, total, msLeft);
  const myRow = board?.find((r) => r.user_id === member.user_id);
  const stage = myRow?.stage ?? stageFor(day, clan.length_days, finished);
  const myDeaths = useMemo(
    () => (events ?? []).filter((e): e is ClanEvent & { kind: "died" } => e.kind === "died" && e.user_id === member.user_id),
    [events, member.user_id],
  );
  const lastOutDay = member.attempt > 1 && myDeaths[0] ? myDeaths[0].day + 1 : null;

  // ── Moments: death on next open (once per attempt), relight, day complete.
  const [moment, setMoment] = useState<Moment | null>(null);
  useEffect(() => {
    const key = `attempt.${clan.id}`;
    const seen = Number(store.get(key) ?? 0);
    if (!seen) store.set(key, String(member.attempt));
    else if (member.attempt > seen && myDeaths[0]) setMoment({ kind: "death", event: myDeaths[0] });
  }, [clan.id, member.attempt, myDeaths]);

  const acknowledgeDeath = () => {
    store.set(`attempt.${clan.id}`, String(member.attempt));
    setMoment({ kind: "relit" });
  };

  const toggle = useCallback((key: string, next: boolean) => {
    setPending((p) => ({ ...p, [key]: next }));
    setFailed((f) => ({ ...f, [key]: false }));
    if (next) setStoke((s) => s + 1);
    // One write at a time, in order: each response is the full row.
    queue.current = queue.current.then(async () => {
      try {
        const row = await checkTask(clan.id, key, next);
        const d = localDate(tz);
        const nowComplete = clan.tasks.every((task) => row.log[d]?.[task.key]);
        setMember((m) => {
          const wasComplete = clan.tasks.every((task) => m.log[d]?.[task.key]);
          if (nowComplete && !wasComplete && store.get(`celebrated.${clan.id}`) !== d) {
            store.set(`celebrated.${clan.id}`, d);
            const dayNo = daysBetween(row.start_date, d) + 1;
            if ("vibrate" in navigator) navigator.vibrate(MILESTONES.includes(dayNo as never) ? [30, 40, 30, 40, 80] : [30, 40, 60]);
            setMoment({ kind: "complete", day: dayNo });
          }
          return { ...m, ...row };
        });
      } catch (e) {
        setFailed((f) => ({ ...f, [key]: true }));
        toast((e as Error).message, "error");
      } finally {
        setPending(({ [key]: _, ...rest }) => rest);
      }
    });
  }, [clan.id, clan.tasks, tz, toast]);

  // ── Break a rule (S20)
  const [breakOpen, setBreakOpen] = useState(false);
  const [breaking, setBreaking] = useState(false);
  async function breakRule() {
    setBreaking(true);
    try {
      await selfReportFail(clan.id);
      setBreakOpen(false);
      await refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBreaking(false);
    }
  }

  // ── Week strip (Mon–Sun, my calendar)
  const week = useMemo(() => {
    const dow = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(today, i - dow);
      let state: WeekDotState;
      if (date > today) state = "future";
      else if (date === today) state = complete ? "today-kept" : "today";
      else if (date < member.start_date) state = member.attempt > 1 && date === addDays(member.start_date, -1) ? "died" : "before-run";
      else state = "kept";
      return { date: new Date(`${date}T12:00:00Z`), state };
    });
  }, [today, complete, member.start_date, member.attempt]);

  const active = (board ?? []).filter((r) => r.status === "active");
  const clanDone = active.filter((r) => r.done_today).length;
  const flameLine = finished
    ? t("today.flame.legend")
    : mood === "anxious" ? t("today.flame.anxious")
    : complete ? t("today.flame.full", { day })
    : doneCount === 0 ? t("today.flame.hungry")
    : total - doneCount === 1 ? t("today.flame.oneLeft")
    : doneCount === 1 ? t("today.flame.one") : t("today.flame.half");

  return (
    <AppScreen>
      <div className="today" style={{ "--fire-h": hue } as React.CSSProperties}>
        <div className="today__meta">
          <span className="chip"><Icon name="trophy" size={16} /> <span className="num">{Math.max(member.best_run, streak)}</span> best</span>
          {!finished && (
            <span className={`chip${mood === "anxious" ? " chip--danger" : ""}`} aria-label={t("today.timeLeftA11y", { time: formatLeft(msLeft) })}>
              <Icon name="clock" size={16} /> <span className="num">{t("today.timeLeft", { time: formatLeft(msLeft) })}</span>
            </span>
          )}
        </div>

        <section className="hero">
          <Flame key={stoke} className={stoke ? "fl-stoke" : undefined} hue={hue} size={118} stage={finished ? "phoenix" : stage}
                 mood={mood} energy={finished ? 1 : doneCount / total} eyes={persona.eyes}
                 gear={finished ? "crown" : persona.gear} scars={scarsFor(member.attempt)}
                 label={flameLabel(stage, day, doneCount, total)} />
          <div className="hero__num" aria-hidden>{streak}</div>
          <p className="hero__sub">
            {t("today.streakSub", { day, length: clan.length_days })}
            {member.attempt > 1 && ` · ${t("today.attempt", { n: member.attempt })}`}
          </p>
        </section>

        <section className="card stack-sm">
          <div className="row-between">
            <span className="pill pill--stage">{t(`today.stage.${stage}`)}</span>
            <span className="small">{flameLine}</span>
          </div>
          <WeekStrip days={week} locale={typeof navigator === "undefined" ? "en" : navigator.language} />
        </section>

        {finished ? (
          <section className="card card--legend stack-sm center-flow">
            <h2>{t("today.finishedTitle", { challenge: clan.challenge_name })}</h2>
            <p>{t("today.finishedBody", { clan: clan.name })}</p>
            <p className="small">{t("today.finishedLocked")}</p>
          </section>
        ) : (
          <section className="stack-sm" aria-labelledby="today-h">
            <div className="row-between">
              <h2 id="today-h">{t("today.section")}</h2>
              <span className="small num">{t("today.progress", { done: doneCount, total })}</span>
            </div>
            <div className="tiles">
              {clan.tasks.map((task, i) => (
                <TaskTile key={task.key} label={task.label} hint={task.hint} icon={taskIcon(task.label)}
                          done={done[i]} saving={task.key in pending} error={failed[task.key]}
                          onToggle={() => toggle(task.key, !done[i])} />
              ))}
            </div>
          </section>
        )}

        <Link href="/clan" className="card stack-sm quest">
          <div className="row-between">
            <h2>{t("today.clanQuest")}</h2>
            <span className="small num">{t("today.progress", { done: clanDone, total: active.length || 1 })}</span>
          </div>
          <div className="bar"><span style={{ width: `${active.length ? (100 * clanDone) / active.length : 0}%` }} /></div>
          <div className="quest__flames" aria-hidden>
            {active.slice(0, 12).map((r) => (
              <Flame key={r.user_id} hue={r.persona.hue ?? 18} size={28} static stage={r.stage}
                     mood={r.finished ? "full" : r.done_today ? "full" : r.tasks_done ? "half" : "hungry"}
                     energy={r.tasks_total ? r.tasks_done / r.tasks_total : 0} gear={r.finished ? "crown" : r.persona.gear} />
            ))}
          </div>
        </Link>

        <section className="card stack-sm">
          <div className="row-between">
            <h2 id="run-h">{t("today.yourRun")}</h2>
            {lastOutDay && <span className="small">{t("today.lastOut", { day: lastOutDay })}</span>}
          </div>
          <ProgressTrack length={clan.length_days} day={day} todayComplete={complete || finished} lastOutDay={lastOutDay} />
        </section>

        {!finished && (
          <button className="btn btn--ghost break-link" onClick={() => setBreakOpen(true)}>{t("today.brokeRule")}</button>
        )}
      </div>

      <Sheet open={breakOpen} onClose={() => setBreakOpen(false)} label={t("today.breakTitle")}>
        <div className="stack center-flow">
          <h2 className="sheet__title">{t("today.breakTitle")}</h2>
          <p className="muted">{t("today.breakBody", { clan: clan.name })}</p>
          <p className="small">{t("today.breakStakes", { n: day - 1, best: Math.max(member.best_run, day - 1) })}</p>
          <HoldButton onConfirm={breakRule} disabled={breaking}>{t("today.breakConfirm")}</HoldButton>
          <button className="btn btn--ghost" onClick={() => setBreakOpen(false)} autoFocus>{t("today.breakCancel")}</button>
        </div>
      </Sheet>

      {moment?.kind === "complete" && (
        <div className="takeover" role="dialog" aria-modal="true" aria-label={t("today.completeKicker")}
             style={{ "--fire-h": hue } as React.CSSProperties}>
          <span className="burst rays" aria-hidden />
          <Flame className="fl-strike" hue={hue} size={150} stage={stage} mood="full" energy={1} eyes={persona.eyes} gear={persona.gear} />
          <p className="kicker">{MILESTONES.includes(moment.day as never) ? t("feed.milestone", { name: profile?.display_name ?? "", day: moment.day }) : t("today.completeKicker")}</p>
          <h1 className="display">Day {moment.day}</h1>
          <p className="muted">
            {MILESTONES.includes(moment.day as never) ? t(`feed.milestoneSub.${moment.day}`) + " " : ""}
            {t("today.completeBody", { left: Math.max(0, clan.length_days - moment.day), clan: clan.name })}
          </p>
          <button className="btn btn--primary" onClick={() => setMoment(null)} autoFocus>{t("today.completeCta")}</button>
        </div>
      )}

      {moment?.kind === "death" && (
        <div className="takeover takeover--night" role="dialog" aria-modal="true" aria-label={t("death.title", { day: moment.event.day + 1 })}>
          <Flame hue={hue} size={140} stage="spark" mood="dead" energy={0} label={flameLabel(stage, moment.event.day + 1, 0, total, true)} />
          <h1 className="display fade-up">{t("death.title", { day: moment.event.day + 1 })}</h1>
          <p className="fade-up">
            {moment.event.meta.reason === "rule" ? t("death.bodyRule") : t("death.bodyMidnight", { n: moment.event.meta.missed ?? 1 })}
          </p>
          <dl className="death-stats fade-up">
            <div><dt>{t("death.run")}</dt><dd className="num">{moment.event.day}</dd></div>
            <div><dt>{t("death.attempt")}</dt><dd className="num">{moment.event.meta.attempt}</dd></div>
            <div><dt>{t("death.best")}</dt><dd className="num">{member.best_run}</dd></div>
          </dl>
          <button className="btn btn--primary" onClick={acknowledgeDeath} autoFocus>{t("death.relight")}</button>
          <Link className="btn btn--ghost night-link" href="/clan" onClick={acknowledgeDeath}>{t("death.whoBurning")}</Link>
        </div>
      )}

      {moment?.kind === "relit" && (
        <div className="takeover" role="dialog" aria-modal="true" aria-label={t("death.relitTitle")}>
          <span className="kicker">{t("death.relitTag", { n: member.attempt, scars: scarsFor(member.attempt) })}</span>
          <Flame className="fl-strike" hue={hue} size={130} stage="spark" mood="hungry" energy={0.4}
                 eyes={persona.eyes} gear={persona.gear} scars={scarsFor(member.attempt)} />
          <h1 className="display">{t("death.relitTitle")}</h1>
          <p className="muted">{t("death.relitBody", { best: member.best_run })}</p>
          <button className="btn btn--primary" onClick={() => setMoment(null)} autoFocus>{t("death.relitCta")}</button>
        </div>
      )}
    </AppScreen>
  );
}
