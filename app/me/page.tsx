"use client";
// Me (S30): flame + customization, stats, clans, time zone, sign out, delete account.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp, useGate } from "@/components/AppProvider";
import { AppScreen, Loading } from "@/components/Shell";
import { Flame } from "@/components/Flame";
import { FlameEditor } from "@/components/FlameEditor";
import { Icon } from "@/components/Icon";
import { Dialog } from "@/components/Overlay";
import { deleteAccount, updateProfile } from "@/lib/api";
import { scarsFor } from "@/lib/flame";
import { supabase } from "@/lib/supabase";
import { t } from "@/lib/i18n";
import type { Persona } from "@/lib/types";

export default function Me() {
  const ready = useGate("profile");
  const { profile, stats, memberships, active, session, setProfile, setActiveClan, toast } = useApp();
  const router = useRouter();
  const [name, setName] = useState("");
  const [persona, setPersona] = useState<Required<Persona>>({ hue: 18, eyes: "round", gear: "none" });
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.display_name);
    setPersona({ hue: profile.persona.hue ?? 18, eyes: profile.persona.eyes ?? "round", gear: profile.persona.gear ?? "none" });
  }, [profile]);

  if (!ready || !profile || !session) return <Loading />;

  const dirty =
    name.trim() !== profile.display_name ||
    persona.hue !== (profile.persona.hue ?? 18) ||
    persona.eyes !== (profile.persona.eyes ?? "round") ||
    persona.gear !== (profile.persona.gear ?? "none");

  async function save() {
    setBusy(true);
    try {
      setProfile(await updateProfile(session!.user.id, { display_name: name.trim(), persona }));
      toast(t("clan.saved"), "success");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const statItems = [
    [stats?.best_run ?? 0, t("me.bestRun")],
    [stats?.deaths ?? 0, t("me.flamesLost")],
    [stats?.finished ?? 0, t("me.finished")],
    [memberships?.length ?? 0, t("me.clans")],
  ] as const;

  return (
    <AppScreen topbar={false}>
      <section className="hero me-hero" style={{ "--fire-h": persona.hue } as React.CSSProperties}>
        <Flame hue={persona.hue} size={130} stage="blaze" mood="full" energy={1} eyes={persona.eyes} gear={persona.gear}
               scars={scarsFor(active?.attempt ?? 1)} label={`${name}'s flame`} />
        <div className="field me-name">
          <label htmlFor="me-name" className="sr-only">{t("me.editName")}</label>
          <input id="me-name" className="input center" maxLength={32} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      </section>

      <dl className="stats">
        {statItems.map(([value, label]) => (
          <div key={label} className="card"><dd className="num">{value}</dd><dt className="small">{label}</dt></div>
        ))}
      </dl>

      <section className="card">
        <FlameEditor persona={persona} onChange={setPersona} unlocked={stats?.unlocked_gear ?? ["none"]} bestRun={stats?.best_run ?? 0} />
      </section>
      {dirty && (
        <button className="btn btn--primary sticky-save" onClick={save} disabled={busy || !name.trim()}>{t("clan.save")}</button>
      )}

      <section className="card stack-sm">
        <h2>{t("me.clans")}</h2>
        <ul className="list">
          {memberships?.map((m) => (
            <li key={m.clan_id}>
              <button className="row row--button" onClick={() => { setActiveClan(m.clan_id); router.push("/clan"); }}>
                <span className="clan-badge" aria-hidden>{m.clan.name.slice(0, 1).toUpperCase()}</span>
                <span className="row__main">
                  <strong>{m.clan.name}</strong>
                  <span className="small">{m.status === "pending" ? t("join.pendingTitle") : `${m.clan.challenge_name} · ${m.role === "leader" ? t("clan.leader") : `Attempt ${m.attempt}`}`}</span>
                </span>
                <Icon name="chevron" />
              </button>
            </li>
          ))}
        </ul>
        {(memberships?.length ?? 0) < 5 && (
          <div className="row-2">
            <Link className="btn btn--secondary btn--sm" href="/new"><Icon name="plus" /> {t("setup.startClan")}</Link>
            <Link className="btn btn--secondary btn--sm" href="/start#join"><Icon name="users" /> Join</Link>
          </div>
        )}
      </section>

      <section className="card stack-sm">
        <div className="row-between">
          <span><Icon name="globe" size={18} /> {t("me.timezone")}</span>
          <span className="small">{t("me.timezoneAuto", { tz: profile.timezone })}</span>
        </div>
      </section>

      <button className="btn btn--secondary" onClick={() => supabase?.auth.signOut()}>
        <Icon name="logout" /> {t("me.signOut")}
      </button>
      <button className="btn btn--ghost danger-text" onClick={() => setDeleteOpen(true)}>{t("me.deleteAccount")}</button>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} label={t("me.deleteAccount")}>
        <h2>{t("me.deleteAccount")}?</h2>
        <p className="muted">Your profile, flames and history are deleted for good. Clans you lead pass to the next member.</p>
        <div className="stack-sm">
          <button className="btn btn--danger" disabled={busy} onClick={async () => {
            setBusy(true);
            try {
              await deleteAccount();
              await supabase?.auth.signOut();
            } catch (e) {
              toast((e as Error).message, "error");
              setBusy(false);
            }
          }}>{t("me.deleteAccount")}</button>
          <button className="btn btn--ghost" onClick={() => setDeleteOpen(false)} autoFocus>{t("clan.stay")}</button>
        </div>
      </Dialog>
    </AppScreen>
  );
}
