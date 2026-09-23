"use client";
// S08 pick a challenge → S09 tasks → S10 name + leaderboard → S11 invite.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp, useGate } from "@/components/AppProvider";
import { Loading } from "@/components/Shell";
import { Invite } from "@/components/Invite";
import { Icon } from "@/components/Icon";
import { createClan } from "@/lib/api";
import { TEMPLATES, taskKey, type Template } from "@/lib/templates";
import { taskIcon } from "@/lib/taskIcon";
import { t } from "@/lib/i18n";
import type { Clan, Task } from "@/lib/types";

type Draft = { key?: string; label: string; hint: string };

export default function NewClan() {
  const ready = useGate("profile");
  const { refresh, setActiveClan, toast } = useApp();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [template, setTemplate] = useState<Template>(TEMPLATES[0]);
  const [tasks, setTasks] = useState<Draft[]>([]);
  const [name, setName] = useState("");
  const [challenge, setChallenge] = useState("");
  const [length, setLength] = useState(90);
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Clan | null>(null);

  if (!ready) return <Loading />;

  function pick(tpl: Template) {
    setTemplate(tpl);
    setTasks(tpl.tasks.length ? tpl.tasks.map((x) => ({ key: x.key, label: x.label, hint: x.hint ?? "" })) : [{ label: "", hint: "" }]);
    setChallenge(tpl.id === "custom" ? "" : tpl.name);
    setLength(tpl.length_days);
    setStep(2);
  }

  const taskErrors = tasks.map((x) =>
    !x.label.trim() ? t("create.taskEmpty") : x.label.length > 60 ? t("create.taskTooLong") : x.hint.length > 120 ? t("create.hintTooLong") : null,
  );
  const tasksValid = tasks.length >= 1 && tasks.length <= 10 && taskErrors.every((e) => !e);
  const detailsValid =
    name.trim().length >= 2 && name.trim().length <= 40 && challenge.trim().length >= 1 && length >= 7 && length <= 365;

  const update = (i: number, patch: Partial<Draft>) => setTasks((ts) => ts.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) =>
    setTasks((ts) => {
      const next = [...ts];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });

  async function create() {
    if (busy) return;
    setBusy(true);
    const keys: string[] = [];
    const finalTasks: Task[] = tasks.map((x) => {
      const key = x.key && !keys.includes(x.key) ? x.key : taskKey(x.label, keys);
      keys.push(key);
      return { key, label: x.label.trim(), ...(x.hint.trim() ? { hint: x.hint.trim() } : {}) };
    });
    try {
      const clan = await createClan({ name: name.trim(), challengeName: challenge.trim(), lengthDays: length, tasks: finalTasks, isPublic });
      setActiveClan(clan.id);
      await refresh();
      setCreated(clan);
      setStep(4);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (step === 4 && created) {
    return (
      <main className="flow">
        <span className="kicker">{t("create.day1Today")}</span>
        <h1>{t("create.litTitle", { clan: created.name })}</h1>
        <p className="muted">{t("create.litBody")}</p>
        <Invite clan={created} />
        <button className="btn btn--secondary" onClick={() => router.replace("/")}>{t("create.goToday")}</button>
      </main>
    );
  }

  return (
    <main className="flow">
      <div className="flow__head">
        {step === 1 ? (
          <Link href="/start" className="icon-btn" aria-label="Back"><Icon name="back" /></Link>
        ) : (
          <button className="icon-btn" aria-label="Back" onClick={() => setStep((s) => (s - 1) as 1 | 2)}><Icon name="back" /></button>
        )}
        <span className="small">{t("create.title")} · {step}/3</span>
      </div>
      <div className="steps" aria-hidden>
        {[1, 2, 3].map((n) => <span key={n} data-on={n <= step ? "" : undefined} />)}
      </div>

      {step === 1 && (
        <section className="stack">
          <h1>{t("create.pickTitle")}</h1>
          <p className="muted">{t("create.pickBody")}</p>
          {TEMPLATES.map((tpl) => (
            <button key={tpl.id} className="choice" onClick={() => pick(tpl)}>
              <span className="choice__icon"><Icon name={tpl.id === "custom" ? "pencil" : "flag"} size={26} /></span>
              <span>
                <strong>{tpl.id === "custom" ? t("create.customName") : tpl.name}</strong>
                <span className="small">
                  {tpl.id === "custom" ? t("create.customMeta") : t("create.templateMeta", { days: tpl.length_days, count: tpl.tasks.length })}
                </span>
              </span>
              <Icon name="chevron" />
            </button>
          ))}
        </section>
      )}

      {step === 2 && (
        <section className="stack">
          <div className="row-between">
            <h1>{t("create.tasksTitle")}</h1>
            <span className="small num">{t("create.tasksCount", { n: tasks.length })}</span>
          </div>
          <ol className="task-edit">
            {tasks.map((x, i) => (
              <li key={i} className="card task-edit__row">
                <span className="tile__icon" aria-hidden><Icon name={taskIcon(x.label)} /></span>
                <div className="stack-sm grow">
                  <div className="field">
                    <label htmlFor={`task-${i}`}>{t("create.taskLabel")} {i + 1}</label>
                    <input id={`task-${i}`} className="input" maxLength={60} value={x.label}
                           placeholder={t("create.taskPlaceholder")} aria-invalid={!!taskErrors[i] || undefined}
                           onChange={(e) => update(i, { label: e.target.value })} />
                    {taskErrors[i] && x.label !== "" && <p className="field__error">{taskErrors[i]}</p>}
                  </div>
                  <div className="field">
                    <label htmlFor={`hint-${i}`}>{t("create.hintLabel")}</label>
                    <input id={`hint-${i}`} className="input input--sm" maxLength={120} value={x.hint}
                           onChange={(e) => update(i, { hint: e.target.value })} />
                  </div>
                </div>
                <div className="task-edit__tools">
                  <button className="icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                    <Icon name="chevron" className="rot-up" />
                  </button>
                  <button className="icon-btn" aria-label="Move down" disabled={i === tasks.length - 1} onClick={() => move(i, 1)}>
                    <Icon name="chevronDown" />
                  </button>
                  <button className="icon-btn" aria-label={t("create.delete")} disabled={tasks.length <= 1}
                          onClick={() => setTasks((ts) => ts.filter((_, j) => j !== i))}>
                    <Icon name="x" />
                  </button>
                </div>
              </li>
            ))}
          </ol>
          {tasks.length < 10 ? (
            <button className="btn btn--secondary" onClick={() => setTasks((ts) => [...ts, { label: "", hint: "" }])}>
              <Icon name="plus" /> {t("create.addTask")}
            </button>
          ) : (
            <p className="small">{t("create.maxTasks")}</p>
          )}
          <p className="small">{t("create.tasksNote")}</p>
          <button className="btn btn--primary" disabled={!tasksValid} onClick={() => setStep(3)}>{t("setup.next")}</button>
        </section>
      )}

      {step === 3 && (
        <section className="stack">
          <h1>{t("create.nameTitle")}</h1>
          <div className="field">
            <label htmlFor="clan-name">{t("create.clanName")}</label>
            <input id="clan-name" className="input" maxLength={40} value={name} autoFocus
                   placeholder={t("create.clanNamePlaceholder")} onChange={(e) => setName(e.target.value)} />
            <span className="field__count">{name.trim().length}/40</span>
          </div>
          <div className="field">
            <label htmlFor="challenge">{t("create.challengeName")}</label>
            <input id="challenge" className="input" maxLength={40} value={challenge} onChange={(e) => setChallenge(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="length">{t("create.length")}</label>
            {template.id === "custom" ? (
              <input id="length" className="input num" type="number" min={7} max={365} value={length}
                     onChange={(e) => setLength(Number(e.target.value))} aria-describedby="length-note" />
            ) : (
              <p id="length" className="input input--static num">{t("create.lengthValue", { n: length })}</p>
            )}
            {template.id === "custom" && <span id="length-note" className="field__count">{t("create.lengthRange")}</span>}
          </div>
          <div className="card row-between">
            <div>
              <strong id="lb-label">{t("create.leaderboard")}</strong>
              <p className="small">{t("create.leaderboardNote")}</p>
            </div>
            <button className="switch" role="switch" aria-checked={isPublic} aria-labelledby="lb-label"
                    onClick={() => setIsPublic((v) => !v)} />
          </div>
          <button className="btn btn--primary" disabled={!detailsValid || busy} onClick={create}>
            {busy ? t("system.saving") : t("create.create")}
          </button>
          <p className="small center">{t("create.day1Today")}</p>
        </section>
      )}
    </main>
  );
}
