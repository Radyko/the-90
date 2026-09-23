"use client";
// S07: your flame needs a clan. Start one, or paste an invite link / code.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp, useGate } from "@/components/AppProvider";
import { Loading } from "@/components/Shell";
import { Sheet } from "@/components/Overlay";
import { Flame } from "@/components/Flame";
import { Icon } from "@/components/Icon";
import { t } from "@/lib/i18n";
import { parseInvite } from "@/lib/api";

export default function Start() {
  const ready = useGate("profile");
  const { profile, memberships } = useApp();
  const router = useRouter();
  const [joinOpen, setJoinOpen] = useState(false);
  const [link, setLink] = useState("");

  useEffect(() => {
    if (window.location.hash === "#join") setJoinOpen(true);
  }, []);

  if (!ready || !profile) return <Loading />;
  const code = parseInvite(link);
  const persona = profile.persona;

  return (
    <main className="flow">
      {!!memberships?.length && (
        <Link href="/" className="btn btn--ghost back-link"><Icon name="back" /> {t("tabs.today")}</Link>
      )}
      <div className="flame-stage">
        <Flame hue={persona.hue ?? 18} size={120} stage="spark" mood="hungry" energy={0.3} eyes={persona.eyes}
               gear={persona.gear} label="Your flame, waiting for a clan" />
      </div>
      <h1 className="center">{t("setup.noClanTitle")}</h1>
      <p className="muted center">{t("setup.noClanBody")}</p>
      <div className="stack">
        <Link href="/new" className="choice">
          <span className="choice__icon"><Icon name="plus" size={28} /></span>
          <span><strong>{t("setup.startClan")}</strong><span className="small">{t("setup.startClanSub")}</span></span>
          <Icon name="chevron" />
        </Link>
        <button className="choice" onClick={() => setJoinOpen(true)}>
          <span className="choice__icon choice__icon--clan"><Icon name="users" size={28} /></span>
          <span><strong>{t("setup.joinClan")}</strong><span className="small">{t("setup.joinClanSub")}</span></span>
          <Icon name="chevron" />
        </button>
      </div>

      <Sheet open={joinOpen} onClose={() => setJoinOpen(false)} label={t("setup.joinClan")}>
        <form className="stack" onSubmit={(e) => { e.preventDefault(); if (code) router.push(`/j/${code}`); }}>
          <h2 className="sheet__title">{t("setup.joinClan")}</h2>
          <div className="field">
            <label htmlFor="invite">Invite link or code</label>
            <input id="invite" className="input" value={link} onChange={(e) => setLink(e.target.value)}
                   placeholder="https://…/j/3f9c…" autoFocus autoComplete="off" />
            {link && !code && <p className="field__error"><Icon name="x" size={16} /> {t("join.errInvalidTitle")}</p>}
          </div>
          <button className="btn btn--primary" type="submit" disabled={!code}>{t("setup.next")}</button>
        </form>
      </Sheet>
    </main>
  );
}
