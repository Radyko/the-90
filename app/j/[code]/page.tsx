"use client";
// Invite link. S04 preview (works signed out) → S12 request → S13 pending (live) → S14 approved.
// S15 errors: invalid link · full · 5-clan limit · rejected.

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { Loading } from "@/components/Shell";
import { Flame } from "@/components/Flame";
import { Icon } from "@/components/Icon";
import { leaveClan, previewClan, requestJoin } from "@/lib/api";
import { taskIcon } from "@/lib/taskIcon";
import { store } from "@/lib/store";
import { t } from "@/lib/i18n";
import type { ClanPreview } from "@/lib/types";

type Problem = "invalid" | "full" | "limit" | "rejected";

export default function Join() {
  const code = String(useParams<{ code: string }>().code ?? "").toLowerCase();
  const { session, profile, memberships, refresh, setActiveClan, toast } = useApp();
  const router = useRouter();
  const [preview, setPreview] = useState<ClanPreview | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState(false);

  const load = useCallback(async () => {
    try {
      setPreview(await previewClan(code));
    } catch {
      setPreview(null);
    }
  }, [code]);

  // Remember the invite across sign-in and setup.
  useEffect(() => {
    store.set("pendingJoin", code);
    load();
  }, [code, load]);

  // Preview in the clan's own colors.
  useEffect(() => {
    if (preview?.theme) document.documentElement.dataset.theme = preview.theme;
  }, [preview?.theme]);

  useEffect(() => {
    if (session && profile === null) router.replace("/setup");
  }, [session, profile, router]);

  const mine = memberships?.find((m) => m.clan_id === preview?.id);

  // Pending → active while watching this screen = approved (S14).
  useEffect(() => {
    if (mine?.status === "active" && store.get(`requested.${mine.clan_id}`)) {
      store.set(`requested.${mine.clan_id}`, null);
      setApproved(true);
    }
  }, [mine?.status, mine?.clan_id]);

  // Re-check the preview whenever my memberships change (e.g. a rejection removed my request).
  useEffect(() => {
    if (memberships) load();
  }, [memberships, load]);

  if (preview === undefined || session === undefined || (session && profile === undefined)) return <Loading />;

  const done = (clanId?: string) => {
    store.set("pendingJoin", null);
    if (clanId) setActiveClan(clanId);
    router.replace("/");
  };

  const wasRequested = preview && store.get(`requested.${preview.id}`);
  const problem: Problem | null = !preview
    ? "invalid"
    : mine
      ? null
      : wasRequested && session
        ? "rejected"
        : preview.members >= preview.max_members
          ? "full"
          : (memberships?.length ?? 0) >= 5
            ? "limit"
            : null;

  if (approved && preview) {
    return (
      <main className="takeover takeover--legend" role="dialog" aria-label={t("join.approvedTitle")}>
        <span className="burst rays" aria-hidden />
        <Flame hue={profile?.persona.hue ?? 18} size={130} stage="spark" mood="full" energy={1}
               eyes={profile?.persona.eyes} gear={profile?.persona.gear} className="fl-strike" />
        <h1 className="display">{t("join.approvedTitle")}</h1>
        <p>{t("join.approvedBody", { clan: preview.name })}</p>
        <button className="btn btn--primary" onClick={() => done(preview.id)} autoFocus>{t("join.approvedCta")}</button>
      </main>
    );
  }

  if (problem) {
    const name = preview?.name ?? "";
    const copy = {
      invalid: ["join.errInvalidTitle", "join.errInvalidBody"],
      full: ["join.errFullTitle", "join.errFullBody"],
      limit: ["join.errLimitTitle", "join.errLimitBody"],
      rejected: ["join.errRejectedTitle", "join.errRejectedBody"],
    }[problem];
    return (
      <main className="flow center-flow">
        <span className="auth__icon auth__icon--danger" aria-hidden><Icon name="x" size={36} /></span>
        <h1>{t(copy[0], { clan: name })}</h1>
        <p className="muted">{t(copy[1], { clan: name, max: preview?.max_members ?? 0 })}</p>
        <div className="stack-sm">
          {problem === "invalid" && <button className="btn btn--primary" onClick={() => router.push("/start#join")}>{t("join.errInvalidCta")}</button>}
          {problem === "limit" && <button className="btn btn--primary" onClick={() => router.push("/me")}>{t("join.errLimitCta")}</button>}
          {(problem === "full" || problem === "rejected") && <button className="btn btn--primary" onClick={() => router.push("/new")}>{t("setup.startClan")}</button>}
          <button className="btn btn--ghost" onClick={() => { if (preview) store.set(`requested.${preview.id}`, null); done(); }}>{t("join.backHome")}</button>
        </div>
      </main>
    );
  }

  const p = preview!;

  if (mine?.status === "pending") {
    return (
      <main className="flow center-flow">
        <Flame hue={profile?.persona.hue ?? 18} size={110} stage="spark" mood="hungry" energy={0.2} eyes={profile?.persona.eyes} />
        <h1>{t("join.pendingTitle")}</h1>
        <p className="muted">{t("join.pendingBody", { clan: p.name })}</p>
        <p className="small live-dot" role="status">{t("join.live")}</p>
        <button className="btn btn--ghost" disabled={busy} onClick={async () => {
          setBusy(true);
          try {
            await leaveClan(p.id);
            store.set(`requested.${p.id}`, null);
            store.set("pendingJoin", null);
            await refresh();
            router.replace("/");
          } catch (e) {
            toast((e as Error).message, "error");
            setBusy(false);
          }
        }}>{t("join.cancel")}</button>
      </main>
    );
  }

  if (mine?.status === "active") {
    return (
      <main className="flow center-flow">
        <h1>{p.name}</h1>
        <p className="muted">You’re already in this clan.</p>
        <button className="btn btn--primary" onClick={() => done(p.id)}>{t("tabs.today")}</button>
      </main>
    );
  }

  async function request() {
    setBusy(true);
    try {
      await requestJoin(code);
      await refresh(); // my pending membership must exist before we mark the request
      store.set(`requested.${p.id}`, "1");
      setActiveClan(p.id);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flow">
      <p className="kicker">{t("join.invitedTo")}</p>
      <div className="card invite-card">
        <span className="clan-badge clan-badge--lg" aria-hidden>{p.name.slice(0, 1).toUpperCase()}</span>
        <h1>{p.name}</h1>
        <p className="small">{p.challenge_name} · {p.length_days} days · {t("join.members", { n: p.members })}</p>
      </div>
      <h2>{t("join.everyDay")}</h2>
      <ul className="list">
        {p.tasks.map((task) => (
          <li key={task.key} className="row">
            <span className="tile__icon" aria-hidden><Icon name={taskIcon(task.label)} /></span>
            <span className="row__main"><strong>{task.label}</strong>{task.hint && <span className="small">{task.hint}</span>}</span>
          </li>
        ))}
      </ul>
      {session ? (
        <>
          <button className="btn btn--primary" onClick={request} disabled={busy}>{t("join.request")}</button>
          <p className="small center">{t("join.requestNote", { n: memberships?.length ?? 0 })}</p>
        </>
      ) : (
        <>
          <button className="btn btn--primary" onClick={() => router.push("/signin")}>{t("join.signInToJoin")}</button>
          <p className="small center">{t("join.signedOutNote")}</p>
        </>
      )}
    </main>
  );
}
