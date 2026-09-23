"use client";

// Temporary shell: auth + profile bootstrap only. The game UI (Today / Clan / Ranks / Me)
// will be built from the Claude Design handoff on top of lib/api.ts.

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isConfigured } from "@/lib/supabase";
import { getMyProfile, syncMe } from "@/lib/api";
import type { Profile } from "@/lib/types";

export default function Home() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!isConfigured) {
    return (
      <main className="shell narrow">
        <h1 className="title">The 90</h1>
        <p className="lede">
          Fill in <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{" "}
          <code>.env.local</code>, then restart the dev server.
        </p>
      </main>
    );
  }
  if (session === undefined) return <main className="shell narrow"><p className="quiet">Loading…</p></main>;
  return session ? <SignedIn session={session} /> : <SignIn />;
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || state === "sending") return;
    setState("sending");
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + window.location.search },
    });
    setState(error ? "idle" : "sent");
    if (error) setError(error.message);
  }

  return (
    <main className="shell narrow">
      <h1 className="title">The 90</h1>
      <p className="lede">Keep your flame alive. Every task, every day, with your clan.</p>
      {state === "sent" ? (
        <div className="sent" role="status">
          <p className="sent-head">Check your email.</p>
          <p className="quiet">We sent a sign-in link to <strong>{email.trim()}</strong>.</p>
        </div>
      ) : (
        <form className="signin" onSubmit={submit}>
          <label htmlFor="email" className="label">Email</label>
          <div className="signin-row">
            <input id="email" type="email" required autoComplete="email" placeholder="you@example.com"
                   value={email} onChange={(e) => setEmail(e.target.value)} />
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

function SignedIn({ session }: { session: Session }) {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    syncMe()
      .then(() => getMyProfile(session.user.id))
      .then(setProfile)
      .catch((e: Error) => setError(e.message));
  }, [session.user.id]);

  return (
    <main className="shell narrow">
      <h1 className="title">The 90</h1>
      <p className="lede">
        Signed in as <strong>{session.user.email}</strong>.{" "}
        {profile === undefined ? "Loading…" : profile ? `Welcome back, ${profile.display_name}.` : "No profile yet."}
      </p>
      <p className="quiet">The new game UI is being designed. The backend is live.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="linklike" onClick={() => supabase?.auth.signOut()}>Sign out</button>
    </main>
  );
}
