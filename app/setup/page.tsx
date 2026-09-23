"use client";
// S05 name → S06 make your flame. Creates the profile, then the gate routes on
// (pending invite → /j/code, otherwise → /start).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp, useGate } from "@/components/AppProvider";
import { Loading } from "@/components/Shell";
import { Flame } from "@/components/Flame";
import { FlameEditor } from "@/components/FlameEditor";
import { Icon } from "@/components/Icon";
import { createProfile } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { Persona } from "@/lib/types";

export default function Setup() {
  const ready = useGate("session");
  const { session, profile, setProfile, refresh, toast } = useApp();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState(() => session?.user.email?.split("@")[0].slice(0, 32) ?? "");
  const [persona, setPersona] = useState<Required<Persona>>({ hue: 18, eyes: "round", gear: "none" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile) router.replace("/");
  }, [profile, router]);

  if (!ready || profile) return <Loading />;

  const trimmed = name.trim();
  async function lightIt() {
    if (!session || busy) return;
    setBusy(true);
    try {
      setProfile(await createProfile(session.user.id, trimmed, persona));
      await refresh();
      router.replace("/");
    } catch (e) {
      toast((e as Error).message, "error");
      setBusy(false);
    }
  }

  return (
    <main className="flow">
      <div className="steps" aria-label={`Step ${step} of 2`}>
        <span data-on="" /><span data-on={step === 2 ? "" : undefined} />
      </div>

      {step === 1 ? (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); if (trimmed) setStep(2); }}>
          <h1>{t("setup.nameTitle")}</h1>
          <p className="muted">{t("setup.nameBody")}</p>
          <div className="field">
            <label htmlFor="name">{t("setup.nameLabel")}</label>
            <input id="name" className="input" maxLength={32} value={name} autoFocus
                   onChange={(e) => setName(e.target.value)} />
            <span className="field__count">{trimmed.length}/32</span>
          </div>
          <button className="btn btn--primary" type="submit" disabled={!trimmed}>
            {t("setup.next")} <Icon name="chevron" />
          </button>
        </form>
      ) : (
        <div className="stack">
          <h1>{t("setup.flameTitle")}</h1>
          <p className="muted">{t("setup.flameBody")}</p>
          <div className="flame-stage">
            <Flame hue={persona.hue} size={140} stage="flame" mood="full" energy={1} eyes={persona.eyes}
                   label={`${trimmed}'s flame`} />
          </div>
          <FlameEditor persona={persona} onChange={setPersona} unlocked={["none"]} />
          <button className="btn btn--primary" onClick={lightIt} disabled={busy}>{t("setup.lightIt")}</button>
          <button className="btn btn--ghost" onClick={() => setStep(1)}><Icon name="back" /> Back</button>
        </div>
      )}
    </main>
  );
}
