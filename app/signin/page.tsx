"use client";
// S01–S03: email magic link. No passwords.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, isConfigured } from "@/lib/supabase";
import { useApp } from "@/components/AppProvider";
import { Flame } from "@/components/Flame";
import { Icon } from "@/components/Icon";
import { t } from "@/lib/i18n";
import { store } from "@/lib/store";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESEND_AFTER = 60;

export default function SignIn() {
  const { session, toast } = useApp();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (session) router.replace("/");
  }, [session, router]);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const valid = EMAIL.test(email.trim());

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    if (!supabase || !valid || state === "sending") return;
    setState("sending");
    const invite = store.get("pendingJoin");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + (invite ? `/j/${invite}` : "/") },
    });
    if (error) {
      setState("idle");
      toast(error.status === 429 ? error.message : t("auth.sendError"), "error");
      return;
    }
    setState("sent");
    setWait(RESEND_AFTER);
  }

  if (!isConfigured) {
    return (
      <main className="center-screen">
        <h1>The 90</h1>
        <p className="muted">Supabase isn’t configured. Add the two env vars and restart.</p>
      </main>
    );
  }

  if (state === "sent") {
    return (
      <main className="auth">
        <span className="auth__icon" aria-hidden><Icon name="mail" size={40} /></span>
        <h1>{t("auth.sentTitle")}</h1>
        <p className="muted">{t("auth.sentBody", { email: email.trim() })}</p>
        <div className="stack-sm auth__actions">
          {wait > 0 ? (
            <p className="small num" role="status">{t("auth.resendIn", { time: `0:${String(wait).padStart(2, "0")}` })}</p>
          ) : (
            <button className="btn btn--secondary" onClick={() => send()}>{t("auth.resend")}</button>
          )}
          <button className="btn btn--ghost" onClick={() => setState("idle")}>{t("auth.differentEmail")}</button>
        </div>
      </main>
    );
  }

  const showError = touched && email.length > 0 && !valid;
  return (
    <main className="auth">
      <Flame hue={18} size={120} stage="flame" mood="full" energy={1} label="The 90 flame" />
      <h1 className="auth__title">{t("app.name")}</h1>
      <p className="muted auth__tagline">{t("app.tagline")}</p>
      <form className="stack auth__form" onSubmit={send} noValidate>
        <div className="field">
          <label htmlFor="email">{t("auth.emailLabel")}</label>
          <input id="email" className="input" type="email" inputMode="email" autoComplete="email"
                 placeholder={t("auth.emailPlaceholder")} value={email}
                 onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched(true)}
                 aria-invalid={showError || undefined} aria-describedby={showError ? "email-err" : undefined} />
          {showError && (
            <p id="email-err" className="field__error"><Icon name="x" size={16} /> {t("auth.invalidEmail")}</p>
          )}
        </div>
        <button className="btn btn--primary" type="submit" disabled={!valid || state === "sending"}>
          {state === "sending" ? t("auth.sending") : t("auth.send")}
        </button>
        <p className="small center">{t("auth.noPasswords")}</p>
      </form>
    </main>
  );
}
