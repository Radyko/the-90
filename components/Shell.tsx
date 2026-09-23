"use client";
// App chrome shared by the four tabs: clan switcher, tab bar, offline banner,
// loading state and the gear-unlock moment.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "./AppProvider";
import { Dialog, Sheet } from "./Overlay";
import { Flame } from "./Flame";
import { Icon, type IconName } from "./Icon";
import { t } from "@/lib/i18n";
import { store } from "@/lib/store";
import { updateProfile } from "@/lib/api";
import type { Gear } from "@/lib/types";

const TABS: { href: string; key: string; icon: IconName }[] = [
  { href: "/", key: "today", icon: "today" },
  { href: "/clan", key: "clan", icon: "clan" },
  { href: "/ranks", key: "ranks", icon: "ranks" },
  { href: "/me", key: "me", icon: "me" },
];

export function Loading() {
  return (
    <main className="center-screen" aria-busy="true">
      <span className="ember-loader" aria-hidden />
      <p className="muted">{t("system.loading")}</p>
    </main>
  );
}

export function AppScreen({ children, topbar = true }: { children: React.ReactNode; topbar?: boolean }) {
  const path = usePathname();
  const online = useOnline();
  return (
    <div className="app">
      {topbar && <TopBar />}
      <main className="screen">
        {!online && (
          <div className="banner--offline" role="status">
            <Icon name="wifiOff" /> {t("system.offline")}
          </div>
        )}
        {children}
      </main>
      <nav className="tabbar" aria-label="Main">
        {TABS.map((tab) => (
          <Link key={tab.href} href={tab.href} aria-current={path === tab.href ? "page" : undefined}>
            <Icon name={tab.icon} size={22} />
            {t(`tabs.${tab.key}`)}
          </Link>
        ))}
      </nav>
      <GearUnlock />
    </div>
  );
}

function TopBar() {
  const { active, memberships, setActiveClan } = useApp();
  const [open, setOpen] = useState(false);
  if (!active) return null;
  const many = (memberships?.length ?? 0) > 1;
  return (
    <header className="topbar">
      <button className="clan-switch" onClick={() => many && setOpen(true)} disabled={!many}
              aria-haspopup={many ? "dialog" : undefined}>
        <span className="clan-badge" aria-hidden>{active.clan.name.slice(0, 1).toUpperCase()}</span>
        <span className="clan-switch__name">{active.clan.name}</span>
        {many && <Icon name="chevronDown" size={18} />}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label="Switch clan">
        <h2 className="sheet__title">Your clans</h2>
        <ul className="list">
          {memberships?.map((m) => (
            <li key={m.clan_id}>
              <button className="row row--button" aria-current={m.clan_id === active.clan_id || undefined}
                      onClick={() => { setActiveClan(m.clan_id); setOpen(false); }}>
                <span className="clan-badge" aria-hidden>{m.clan.name.slice(0, 1).toUpperCase()}</span>
                <span className="row__main">
                  <strong>{m.clan.name}</strong>
                  <span className="small">
                    {m.status === "pending" ? t("join.pendingTitle") : `${m.clan.challenge_name} · ${m.clan.length_days} days`}
                  </span>
                </span>
                {m.clan_id === active.clan_id && <Icon name="check" />}
              </button>
            </li>
          ))}
        </ul>
        {(memberships?.length ?? 0) < 5 && (
          <div className="stack-sm">
            <Link className="btn btn--secondary" href="/new" onClick={() => setOpen(false)}>{t("setup.startClan")}</Link>
            <Link className="btn btn--ghost" href="/start#join" onClick={() => setOpen(false)}>{t("setup.joinClan")}</Link>
          </div>
        )}
      </Sheet>
    </header>
  );
}

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

const UNLOCK_COPY: Record<Exclude<Gear, "none">, [string, string]> = {
  headband: ["me.unlockHeadband", "me.unlockHeadbandBody"],
  horns: ["me.unlockHorns", "me.unlockHornsBody"],
  crown: ["me.unlockCrown", "me.unlockCrownBody"],
};

/** S31: celebrate gear the first time it unlocks (remembered per device). */
function GearUnlock() {
  const { stats, profile, setProfile, session, toast } = useApp();
  const [gear, setGear] = useState<Exclude<Gear, "none"> | null>(null);

  useEffect(() => {
    if (!stats) return;
    const unlocked = stats.unlocked_gear.filter((g): g is Exclude<Gear, "none"> => g !== "none");
    const seenRaw = store.get("seenGear");
    if (seenRaw === null) {
      store.set("seenGear", unlocked.join(",")); // first run on this device: don't celebrate old news
      return;
    }
    const fresh = unlocked.find((g) => !seenRaw.split(",").includes(g));
    if (fresh) setGear(fresh);
  }, [stats]);

  if (!gear || !profile || !session) return null;
  const close = () => {
    store.set("seenGear", [...new Set([...(store.get("seenGear") ?? "").split(",").filter(Boolean), gear])].join(","));
    setGear(null);
  };
  const wear = async () => {
    try {
      setProfile(await updateProfile(session.user.id, { persona: { ...profile.persona, gear } }));
    } catch (e) {
      toast((e as Error).message, "error");
    }
    close();
  };
  const [title, body] = UNLOCK_COPY[gear];
  return (
    <Dialog open onClose={close} label={t(title)}>
      <div className="burst-wrap">
        <span className="burst rays" aria-hidden />
        <Flame hue={profile.persona.hue ?? 18} size={110} stage="blaze" mood="full" energy={1}
               eyes={profile.persona.eyes} gear={gear} />
      </div>
      <p className="kicker">{t("me.unlockKicker")}</p>
      <h2 className="display">{t(title)}</h2>
      <p className="muted">{t(body)}</p>
      <div className="stack-sm">
        <button className="btn btn--legend" onClick={wear} autoFocus>{t("me.wear")}</button>
        <button className="btn btn--ghost" onClick={close}>{t("me.later")}</button>
      </div>
    </Dialog>
  );
}
