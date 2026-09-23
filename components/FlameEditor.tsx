"use client";
// Color / eyes / gear pickers for the flame (Setup S06 and Me S30).

import type { Eyes, Gear, Persona } from "@/lib/types";
import { nextUnlock } from "@/lib/flame";
import { Icon } from "./Icon";
import { t } from "@/lib/i18n";

const SWATCHES = [18, 0, 330, 280, 220, 190, 140, 48];
const EYES: Eyes[] = ["round", "sharp", "sleepy", "happy"];
const GEAR: { gear: Gear; lock?: string }[] = [
  { gear: "none" },
  { gear: "headband", lock: t("setup.lockedDay", { n: 7 }) },
  { gear: "horns", lock: t("setup.lockedDay", { n: 30 }) },
  { gear: "crown", lock: t("setup.lockedFinish") },
];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export function FlameEditor({
  persona, onChange, unlocked, bestRun = 0,
}: {
  persona: Required<Persona>;
  onChange: (p: Required<Persona>) => void;
  unlocked: Gear[];
  bestRun?: number;
}) {
  const next = nextUnlock(bestRun, unlocked.includes("crown"));
  return (
    <div className="stack">
      <fieldset className="picker">
        <legend>{t("setup.color")}</legend>
        <input className="hue" type="range" min={0} max={359} value={persona.hue} aria-label="Flame hue"
               onChange={(e) => onChange({ ...persona, hue: Number(e.target.value) })} />
        <div className="swatches">
          {SWATCHES.map((h) => (
            <button key={h} type="button" className="swatch" aria-label={`Hue ${h}`} aria-pressed={persona.hue === h}
                    style={{ background: `hsl(${h} 95% 58%)` }} onClick={() => onChange({ ...persona, hue: h })} />
          ))}
        </div>
      </fieldset>

      <fieldset className="picker">
        <legend>{t("setup.eyes")}</legend>
        <div className="options">
          {EYES.map((e) => (
            <button key={e} type="button" className="option" aria-pressed={persona.eyes === e}
                    onClick={() => onChange({ ...persona, eyes: e })}>
              {t(`setup.eyes${cap(e)}`)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="picker">
        <legend>{t("setup.gear")}</legend>
        <div className="options">
          {GEAR.map(({ gear, lock }) => {
            const open = unlocked.includes(gear);
            return (
              <button key={gear} type="button" className="option" aria-pressed={persona.gear === gear}
                      disabled={!open} onClick={() => onChange({ ...persona, gear })}>
                {!open && <Icon name="lock" size={16} />}
                {t(`setup.gear${cap(gear)}`)}
                {!open && <span className="option__lock">{lock}</span>}
              </button>
            );
          })}
        </div>
        {next && next.gear !== "crown" && (
          <div className="unlock-progress">
            <span className="small">{t("me.locked", { n: next.target })}</span>
            <div className="bar"><span style={{ width: `${(100 * next.progress) / next.target}%` }} /></div>
          </div>
        )}
      </fieldset>
    </div>
  );
}
