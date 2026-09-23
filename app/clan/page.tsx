"use client";
// Clan (S23–S27): campfire, members, feed, info + leader tools.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp, useGate } from "@/components/AppProvider";
import { AppScreen, Loading } from "@/components/Shell";
import { Campfire, type CampfireMember } from "@/components/Campfire";
import { Flame } from "@/components/Flame";
import { Icon } from "@/components/Icon";
import { Invite } from "@/components/Invite";
import { Dialog, Sheet } from "@/components/Overlay";
import {
  leaveClan, removeMember, respondRequest, rotateInvite, stoke, transferLeadership, updateClan,
} from "@/lib/api";
import { taskIcon } from "@/lib/taskIcon";
import { useClan } from "@/lib/useClan";
import { t } from "@/lib/i18n";
import { CLAN_THEMES, type BoardRow, type ClanEvent, type ClanTheme, type Membership } from "@/lib/types";

const THEME_SWATCH: Record<ClanTheme, string> = {
  sunset: "#FF5A5F", campfire: "#FF7B1C", forest: "#2F7D4A", lake: "#3558E0", berry: "#D6336C", sand: "#1D1A17",
};

type Status = "done" | "going" | "out" | "legend";
const statusOf = (r: BoardRow): Status =>
  r.finished ? "legend" : r.done_today ? "done" : r.attempt > 1 && r.day === 1 ? "out" : "going";

export default function ClanPage() {
  const ready = useGate("clan");
  const { active } = useApp();
  if (!ready || !active) return <Loading />;
  if (active.status === "pending") {
    return (
      <AppScreen>
        <div className="card center-flow"><h1>{t("join.pendingTitle")}</h1>
          <p className="muted">{t("join.pendingBody", { clan: active.clan.name })}</p></div>
      </AppScreen>
    );
  }
  return <ClanView key={active.clan_id} membership={active} />;
}

function ClanView({ membership }: { membership: Membership }) {
  const clan = membership.clan;
  const { board, events, reload } = useClan(clan.id);
  const [tab, setTab] = useState<"members" | "feed" | "info">("members");
  const isLeader = membership.role === "leader";

  const rows = useMemo(() => (board ?? []).filter((r) => r.status === "active"), [board]);
  const requests = useMemo(() => (board ?? []).filter((r) => r.status === "pending"), [board]);
  const names = useMemo(() => new Map((board ?? []).map((r) => [r.user_id, r.display_name ?? t("feed.someone")])), [board]);
  const fire: CampfireMember[] = rows.map((r) => ({ id: r.user_id, hue: r.persona.hue ?? 18, day: r.day, state: statusOf(r) }));
  const doneCount = rows.filter((r) => r.done_today || r.finished).length;

  if (!board) return <AppScreen><div className="skel" style={{ height: 240 }} /></AppScreen>;

  return (
    <AppScreen>
      <section className="card campfire-card">
        <div className="row-between">
          <h1>{clan.name}</h1>
          <span className="small num">{t("clan.campfireProgress", { done: doneCount, total: rows.length })}</span>
        </div>
        <p className="small">{clan.challenge_name} · {clan.length_days} days</p>
        <Campfire members={fire} length={clan.length_days} />
      </section>

      <div className="segmented" role="tablist" aria-label={clan.name}>
        {(["members", "feed", "info"] as const).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {t(`clan.${k}`)}
            {k === "members" && isLeader && requests.length > 0 && <span className="badge num">{requests.length}</span>}
          </button>
        ))}
      </div>

      {tab === "members" && (
        <Members clanId={clan.id} rows={rows} requests={isLeader ? requests : []} me={membership.user_id}
                 isLeader={isLeader} onChange={reload} />
      )}
      {tab === "feed" && <Feed events={events ?? []} names={names} clanName={clan.name} challenge={clan.challenge_name} />}
      {tab === "info" && <Info membership={membership} memberCount={rows.length + requests.length} rows={rows} />}
    </AppScreen>
  );
}

function Members({ clanId, rows, requests, me, isLeader, onChange }: {
  clanId: string; rows: BoardRow[]; requests: BoardRow[]; me: string; isLeader: boolean; onChange: () => void;
}) {
  const { toast } = useApp();
  const [manage, setManage] = useState<BoardRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, fn: () => Promise<unknown>, success?: string) {
    setBusy(id);
    try {
      await fn();
      if (success) toast(success, "success");
      onChange();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="stack">
      {isLeader && requests.length > 0 && (
        <section className="card stack-sm">
          <h2>{t("clan.requests", { n: requests.length })}</h2>
          <ul className="list">
            {requests.map((r) => (
              <li key={r.user_id} className="row">
                <Flame hue={r.persona.hue ?? 18} size={36} static stage="spark" mood="hungry" energy={0.2} eyes={r.persona.eyes} />
                <span className="row__main"><strong>{r.display_name}</strong></span>
                <button className="btn btn--primary btn--sm" disabled={busy === r.user_id}
                        onClick={() => act(r.user_id, () => respondRequest(clanId, r.user_id, true))}>{t("clan.letIn")}</button>
                <button className="icon-btn" aria-label={t("clan.reject", { name: r.display_name ?? "" })} disabled={busy === r.user_id}
                        onClick={() => act(r.user_id, () => respondRequest(clanId, r.user_id, false))}><Icon name="x" /></button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rows.length <= 1 && (
        <p className="card muted center">{t("system.emptyMembersTitle")}. {t("system.emptyMembersBody")}</p>
      )}

      <ol className="list">
        {rows.map((r, i) => {
          const status = statusOf(r);
          const mine = r.user_id === me;
          return (
            <li key={r.user_id} className="row member-row">
              <span className="rank num" aria-label={`Rank ${i + 1}`}>{i + 1}</span>
              <Flame hue={r.persona.hue ?? 18} size={40} static stage={r.stage}
                     mood={status === "out" ? "hungry" : status === "going" ? (r.tasks_done ? "half" : "hungry") : "full"}
                     energy={r.finished ? 1 : r.tasks_done / r.tasks_total} eyes={r.persona.eyes}
                     gear={r.finished ? "crown" : r.persona.gear} />
              <span className="row__main">
                <strong>
                  {r.display_name}
                  {mine && <span className="tag">{t("clan.you")}</span>}
                  {r.role === "leader" && <span className="tag tag--clan">{t("clan.leader")}</span>}
                </strong>
                <span className="small num">{t("clan.dayAttempt", { day: r.day, attempt: r.attempt })}</span>
              </span>
              <StatusChip status={status} />
              {!mine && status === "going" && (
                <button className="btn btn--secondary btn--sm" disabled={busy === r.user_id}
                        onClick={() => act(r.user_id, () => stoke(clanId, r.user_id), t("clan.stoked"))}>{t("clan.stoke")}</button>
              )}
              {isLeader && !mine && (
                <button className="icon-btn" aria-label={`Manage ${r.display_name}`} onClick={() => setManage(r)}>
                  <Icon name="grip" />
                </button>
              )}
            </li>
          );
        })}
      </ol>

      <Sheet open={!!manage} onClose={() => setManage(null)} label={manage?.display_name ?? ""}>
        {manage && (
          <div className="stack-sm">
            <h2 className="sheet__title">{manage.display_name}</h2>
            <button className="btn btn--secondary" onClick={() => { setManage(null); act(manage.user_id, () => transferLeadership(clanId, manage.user_id), t("clan.saved")); }}>
              <Icon name="crown" /> {t("clan.makeLeader")}
            </button>
            <button className="btn btn--danger" onClick={() => { setManage(null); act(manage.user_id, () => removeMember(clanId, manage.user_id)); }}>
              {t("clan.remove")}
            </button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function StatusChip({ status }: { status: Status }) {
  const map = {
    done: ["pill--done", "check", "clan.statusDone"],
    going: ["pill--going", "clock", "clan.statusGoing"],
    out: ["pill--out", "x", "clan.statusOut"],
    legend: ["pill--legend", "crown", "clan.statusLegend"],
  } as const;
  const [cls, icon, key] = map[status];
  return <span className={`pill ${cls}`}><Icon name={icon} size={14} strokeWidth={3} /> {t(key)}</span>;
}

function Feed({ events, names, clanName, challenge }: {
  events: ClanEvent[]; names: Map<string, string>; clanName: string; challenge: string;
}) {
  const name = (id: string | null) => (id && names.get(id)) || t("feed.someone");
  const groups = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" });
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86_400_000).toDateString();
    const out: { label: string; items: ClanEvent[] }[] = [];
    for (const e of events) {
      const d = new Date(e.created_at);
      const label = d.toDateString() === today ? t("feed.today") : d.toDateString() === yesterday ? t("feed.yesterday") : fmt.format(d);
      if (out.at(-1)?.label !== label) out.push({ label, items: [] });
      out.at(-1)!.items.push(e);
    }
    return out;
  }, [events]);

  if (!events.length) {
    return <div className="card center-flow"><h2>{t("system.emptyFeedTitle")}</h2><p className="muted">{t("system.emptyFeedBody")}</p></div>;
  }

  return (
    <div className="stack" aria-live="polite">
      {groups.map((g) => (
        <section key={g.label} className="stack-sm">
          <h2 className="feed__day">{g.label}</h2>
          {g.items.map((e) => {
            const who = name(e.user_id);
            switch (e.kind) {
              case "died":
                return (
                  <article key={e.id} className="card card--danger feed-card">
                    <Icon name="x" /><div><strong>{t("feed.died", { name: who, day: e.day + 1 })}</strong>
                    <p className="small">{t("feed.diedSub", { attempt: e.meta.attempt, next: e.meta.attempt + 1 })}</p></div>
                  </article>
                );
              case "milestone":
                return (
                  <article key={e.id} className="card card--legend feed-card">
                    <span className="hexagon num" aria-hidden>{e.day}</span><div><strong>{t("feed.milestone", { name: who, day: e.day })}</strong>
                    <p className="small">{t(`feed.milestoneSub.${e.day}`)}</p></div>
                  </article>
                );
              case "finished":
                return (
                  <article key={e.id} className="card card--legend feed-card">
                    <Icon name="crown" /><div><strong>{t("feed.finished", { name: who, challenge })}</strong>
                    <p className="small">{t("feed.finishedSub")}</p></div>
                  </article>
                );
              case "day_complete":
                return <p key={e.id} className="feed-line"><Icon name="check" size={16} /> {t("feed.dayComplete", { name: who, day: e.day })}</p>;
              case "joined":
                return <p key={e.id} className="feed-line"><Icon name="plus" size={16} /> {t("feed.joined", { name: who, clan: clanName })}</p>;
              case "left":
                return <p key={e.id} className="feed-line muted">{t("feed.left", { name: who })}</p>;
              case "stoke":
                return <p key={e.id} className="feed-line"><Icon name="today" size={16} /> {t("feed.stoke", { name: who, target: name(e.meta.target) })}</p>;
            }
          })}
        </section>
      ))}
    </div>
  );
}

function Info({ membership, memberCount, rows }: { membership: Membership; memberCount: number; rows: BoardRow[] }) {
  const { refresh, toast } = useApp();
  const router = useRouter();
  const clan = membership.clan;
  const isLeader = membership.role === "leader";
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [limit, setLimit] = useState(clan.max_members);
  const [busy, setBusy] = useState(false);

  async function save(patch: Parameters<typeof updateClan>[1], message = t("clan.saved")) {
    setBusy(true);
    try {
      await updateClan(clan.id, patch);
      await refresh();
      toast(message, "success");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const alone = rows.every((r) => r.user_id === membership.user_id);
  const leaveBody = alone
    ? t("clan.leaveBodyLast", { clan: clan.name })
    : isLeader ? t("clan.leaveBodyLeaderAny") : t("clan.leaveBody");

  return (
    <div className="stack">
      <section className="card stack-sm">
        <h2>{clan.challenge_name} · {clan.length_days} days</h2>
        <ul className="list">
          {clan.tasks.map((task) => (
            <li key={task.key} className="row">
              <span className="tile__icon" aria-hidden><Icon name={taskIcon(task.label)} /></span>
              <span className="row__main"><strong>{task.label}</strong>{task.hint && <span className="small">{task.hint}</span>}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card stack-sm">
        <h2>{t("clan.inviteFriends")}</h2>
        <Invite clan={clan} qr={isLeader} />
      </section>

      {isLeader && (
        <section className="card stack">
          <h2>{t("clan.leaderTools")}</h2>
          <div className="stack-sm">
            <div className="row-between"><strong>{t("clan.memberLimit")}</strong>
              <span className="small num">{t("clan.capacity", { n: memberCount, max: clan.max_members })}</span></div>
            <div className="bar"><span style={{ width: `${(100 * memberCount) / clan.max_members}%` }} /></div>
            <div className="invite__link">
              <input className="input num" type="number" min={Math.max(2, memberCount)} max={500} value={limit}
                     aria-label={t("clan.memberLimit")} onChange={(e) => setLimit(Number(e.target.value))} />
              <button className="btn btn--secondary btn--sm" disabled={busy || limit === clan.max_members}
                      onClick={() => save({ maxMembers: limit })}>{t("clan.save")}</button>
            </div>
            <span className="small">{t("clan.memberLimitNote")}</span>
          </div>

          <fieldset className="picker">
            <legend>{t("clan.clanColor")}</legend>
            <p className="small">{t("clan.clanColorBody", { clan: clan.name })}</p>
            <div className="swatches">
              {CLAN_THEMES.map((theme) => (
                <button key={theme} className="swatch swatch--theme" aria-pressed={clan.theme === theme} aria-label={theme}
                        style={{ background: THEME_SWATCH[theme] }} disabled={busy}
                        onClick={() => save({ theme })} />
              ))}
            </div>
          </fieldset>

          <div className="row-between">
            <div><strong id="lb">{t("create.leaderboard")}</strong><p className="small">{t("create.leaderboardNote")}</p></div>
            <button className="switch" role="switch" aria-checked={clan.is_public} aria-labelledby="lb" disabled={busy}
                    onClick={() => save({ isPublic: !clan.is_public })} />
          </div>

          <button className="btn btn--secondary" disabled={busy} onClick={async () => {
            setBusy(true);
            try { await rotateInvite(clan.id); await refresh(); toast(t("clan.rotated"), "success"); }
            catch (e) { toast((e as Error).message, "error"); }
            finally { setBusy(false); }
          }}><Icon name="refresh" /> {t("clan.rotateInvite")}</button>
        </section>
      )}

      <button className="btn btn--ghost danger-text" onClick={() => setLeaveOpen(true)}>{t("clan.leave")}</button>
      <Dialog open={leaveOpen} onClose={() => setLeaveOpen(false)} label={t("clan.leaveTitle", { clan: clan.name })}>
        <h2>{t("clan.leaveTitle", { clan: clan.name })}</h2>
        <p className="muted">{leaveBody}</p>
        <div className="stack-sm">
          <button className="btn btn--danger" disabled={busy} onClick={async () => {
            setBusy(true);
            try { await leaveClan(clan.id); setLeaveOpen(false); await refresh(); router.replace("/"); }
            catch (e) { toast((e as Error).message, "error"); setBusy(false); }
          }}>{t("clan.leave")}</button>
          <button className="btn btn--ghost" onClick={() => setLeaveOpen(false)} autoFocus>{t("clan.stay")}</button>
        </div>
      </Dialog>
    </div>
  );
}
