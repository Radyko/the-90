// The flame character. Pure inline SVG + CSS classes from globals.css. No state, no JS animation.
// Matches the "Flame" artboard and the character sheet on the design canvas exactly (same paths).
// Performance: at size < 40 pass `static` (no embers, no glow). For 41+ campfire members use <FlameGlyph/>.
import type { CSSProperties } from 'react';
import type { Eyes, Gear } from '@/lib/types';
import type { Mood, Stage } from '@/lib/flame';

const BODY = {
  outer: 'M50 6 C60 26 84 40 84 72 C84 98 70 116 50 116 C30 116 16 98 16 72 C16 52 30 44 36 30 C40 40 44 42 46 40 C44 28 46 16 50 6 Z',
  mid: 'M50 36 C58 50 72 60 72 80 C72 98 62 110 50 110 C38 110 28 98 28 82 C28 66 40 60 44 50 C46 56 48 56 49 54 C48 48 48 42 50 36 Z',
  core: 'M50 70 C57 78 62 86 62 95 C62 104 57 109 50 109 C43 109 38 104 38 95 C38 86 43 78 50 70 Z',
};
const EYES: Record<Exclude<Eyes, 'happy'>, string> = {
  round: 'M36.5 84 a4.8 6.2 0 1 0 9.6 0 a4.8 6.2 0 1 0 -9.6 0 Z M53.9 84 a4.8 6.2 0 1 0 9.6 0 a4.8 6.2 0 1 0 -9.6 0 Z',
  sharp: 'M36 80.5 L46.5 83.5 L46.5 89 L36 87.5 Z M64 80.5 L53.5 83.5 L53.5 89 L64 87.5 Z',
  sleepy: 'M36.5 83 h9.6 a4.8 5 0 0 1 -9.6 0 Z M53.9 83 h9.6 a4.8 5 0 0 1 -9.6 0 Z',
};
const HAPPY = 'M36.5 86 Q41.3 78.5 46.1 86 M53.9 86 Q58.7 78.5 63.5 86';
const SLEEPY_LIDS = 'M36.5 84 Q41.3 88 46.1 84 M53.9 84 Q58.7 88 63.5 84';
const SCARS = ['M66 90 l7 -4', 'M67 96 l7 -3', 'M64 102 l6 -2'];
const STAGE_SCALE: Record<Stage, number> = { spark: 0.62, flame: 0.8, blaze: 0.9, inferno: 1, phoenix: 1 };
const STAGE_GLOW: Record<Stage, number> = { spark: 0.5, flame: 0.8, blaze: 1, inferno: 1.35, phoenix: 1.5 };

export interface FlameProps {
  hue: number;
  size: number; // px width; height = size * 1.2
  stage: Stage;
  mood: Mood;
  /** 0–1 share of today's tasks done. Drives size, saturation and glow. */
  energy: number;
  eyes?: Eyes;
  gear?: Gear;
  scars?: number; // 0–3
  /** Hide embers + glow (lists, campfire). */
  static?: boolean;
  /** Screen-reader label. Omit (decorative) when the surrounding text already says it. */
  label?: string;
  className?: string;
}

export function Flame({ hue: h, size, stage, mood, energy, eyes = 'round', gear = 'none', scars = 0, static: isStatic = false, label, className }: FlameProps) {
  const e = Math.max(0, Math.min(1, energy));
  const dead = mood === 'dead';
  const phoenix = stage === 'phoenix';
  const sat = Math.round(45 + 55 * e);
  const outer = `hsl(${h} ${sat}% ${Math.round(40 + 12 * e)}%)`;
  const mid = `hsl(${h + 14} ${Math.min(100, sat + 5)}% ${Math.round(56 + 10 * e)}%)`;
  const core = phoenix ? 'hsl(48 100% 86%)' : `hsl(${h + 36} ${Math.round(70 + 30 * e)}% ${Math.round(78 + 10 * e)}%)`;
  const ink = `hsl(${h} 60% 9%)`;
  const gold = 'hsl(44 95% 56%)';
  const strokeW = size < 60 ? 5 : 3.2;
  const gearW = size < 60 ? 4 : 2.6;
  const happyEyes = eyes === 'happy';
  const open = (mood === 'half' || mood === 'anxious') && !happyEyes;
  const showHappy = mood === 'full' || (happyEyes && mood !== 'hungry');
  const mouth = mood === 'anxious' ? 'M45 98.5 Q47.5 96.5 50 98.5 Q52.5 100.5 55 98.5' : mood === 'full' || happyEyes ? 'M45.5 96 Q50 101 54.5 96' : 'M47 97.5 Q50 99 53 97.5';
  const anim = mood === 'anxious' ? 'fl-anx' : mood === 'full' ? 'fl-calm' : stage === 'spark' ? 'fl-spark' : 'fl-flick';
  const scale = (STAGE_SCALE[stage] * (0.85 + 0.15 * e)).toFixed(3);
  const glowA = Math.min(0.8, (0.12 + 0.38 * e) * STAGE_GLOW[stage]).toFixed(2);
  const embers = !isStatic && !dead && e > 0 && size >= 60 && (stage === 'blaze' || stage === 'inferno' || phoenix);
  const scarD = SCARS.slice(0, Math.max(0, Math.min(3, scars))).join(' ');
  const S = { stroke: 'var(--outline)', strokeWidth: strokeW, strokeLinejoin: 'round' as const, paintOrder: 'stroke' };

  const wrap: CSSProperties = { position: 'relative', width: size, height: Math.round(size * 1.2), flexShrink: 0 };
  const glow: CSSProperties = {
    position: 'absolute', inset: '-30%', pointerEvents: 'none',
    background: `radial-gradient(circle at 50% 64%, ${phoenix ? `hsl(45 100% 60% / ${glowA})` : `hsl(${h} 100% 55% / ${glowA})`} 0%, transparent 60%)`,
  };

  return (
    <span className={className} style={wrap}>
      {!isStatic && !dead && <span aria-hidden style={glow} />}
      <svg width={size} height={Math.round(size * 1.2)} viewBox="0 0 100 120" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} style={{ position: 'relative', display: 'block', overflow: 'visible' }}>
        {dead ? (
          <g>
            <path className="fl-smoke" d="M50 66 C44 58 56 52 50 44 C45 38 54 32 50 24" fill="none" stroke="#9A948F" strokeWidth={3} strokeLinecap="round" />
            <path d="M50 72 C63 76 74 86 74 99 C74 111 63 117 50 117 C37 117 26 111 26 99 C26 86 37 76 50 72 Z" fill="#8F8983" {...S} />
            <path d="M50 84 C58 87 64 93 64 101 C64 108 58 112 50 112 C42 112 36 108 36 101 C36 93 42 87 50 84 Z" fill="#A9A39D" />
            <path d="M37.5 92 l7 7 M44.5 92 l-7 7 M55.5 92 l7 7 M62.5 92 l-7 7" fill="none" stroke="#2F2B28" strokeWidth={2.4} strokeLinecap="round" />
            <path d="M46 106 L54 106" stroke="#2F2B28" strokeWidth={2} strokeLinecap="round" />
          </g>
        ) : (
          <>
            <g className="fl-body" style={{ transform: `scale(${scale})` }}>
              <g className={anim}>
                {(stage === 'inferno' || phoenix) && <path d={BODY.outer} fill={phoenix ? 'hsl(45 100% 62%)' : `hsl(${h + 20} 100% 62%)`} opacity={0.45} transform="translate(50 116) scale(1.16) translate(-50 -116)" />}
                {phoenix && (
                  <>
                    <path d="M30 78 C14 74 4 60 4 42 C12 52 18 56 24 57 C16 48 14 38 16 26 C24 40 30 50 34 62 Z" fill={gold} {...S} />
                    <path d="M70 78 C86 74 96 60 96 42 C88 52 82 56 76 57 C84 48 86 38 84 26 C76 40 70 50 66 62 Z" fill={gold} {...S} />
                  </>
                )}
                <path d={BODY.outer} fill={outer} {...S} />
                <path d={BODY.mid} fill={mid} />
                <path d={BODY.core} fill={core} />
                {scarD && <path d={scarD} fill="none" stroke={ink} strokeOpacity={0.45} strokeWidth={1.6} strokeLinecap="round" />}
                {e > 0 && size >= 40 && (
                  <>
                    <ellipse cx={35} cy={95} rx={4.5} ry={2.8} fill={`hsl(${(h + 340) % 360} 90% 72% / .75)`} />
                    <ellipse cx={65} cy={95} rx={4.5} ry={2.8} fill={`hsl(${(h + 340) % 360} 90% 72% / .75)`} />
                  </>
                )}
                {open && <path d={EYES[eyes as Exclude<Eyes, 'happy'>]} fill={ink} />}
                {open && eyes === 'round' && (
                  <>
                    <circle cx={43.4} cy={81.5} r={1.9} fill="#fff" />
                    <circle cx={60.8} cy={81.5} r={1.9} fill="#fff" />
                  </>
                )}
                {showHappy && <path d={HAPPY} fill="none" stroke={ink} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />}
                {mood === 'hungry' && <path d={SLEEPY_LIDS} fill="none" stroke={ink} strokeWidth={2.4} strokeLinecap="round" />}
                {mood === 'anxious' && <path d="M35.5 78.5 L45 75.5 M64.5 78.5 L55 75.5" fill="none" stroke={ink} strokeWidth={2.2} strokeLinecap="round" />}
                {mood === 'hungry' ? <circle cx={50} cy={97.5} r={2} fill={ink} /> : <path d={mouth} fill="none" stroke={ink} strokeWidth={2} strokeLinecap="round" />}
                {gear === 'headband' && (
                  <>
                    <path d="M21 74 Q50 62 79 74 L79 82 Q50 70 21 82 Z" fill="#E5484D" {...S} strokeWidth={gearW} />
                    <path d="M78 76 L92 70 L89 79 Z M78 80 L93 86 L85 89 Z" fill="#E5484D" {...S} strokeWidth={gearW} />
                  </>
                )}
                {gear === 'horns' && <path d="M34 46 C24 40 20 28 24 16 C28 28 34 34 41 38 Z M66 46 C76 40 80 28 76 16 C72 28 66 34 59 38 Z" fill="#F4EBDD" {...S} strokeWidth={gearW} />}
                {gear === 'crown' && (
                  <>
                    <path d="M35 46 L34 28 L42 35 L50 22 L58 35 L66 28 L65 46 Z" fill={gold} {...S} strokeWidth={gearW} />
                    <circle cx={50} cy={38} r={2.6} fill="#E5484D" />
                  </>
                )}
              </g>
            </g>
            {embers && (
              <g aria-hidden fill={phoenix ? 'hsl(45 100% 65%)' : `hsl(${h + 30} 100% 70%)`}>
                <circle className="fl-ember" cx={30} cy={46} r={1.8} style={{ animationDelay: '0s' }} />
                <circle className="fl-ember" cx={70} cy={36} r={1.4} style={{ animationDelay: '.9s' }} />
                <circle className="fl-ember" cx={57} cy={14} r={1.6} style={{ animationDelay: '1.8s' }} />
              </g>
            )}
          </>
        )}
      </svg>
    </span>
  );
}

/** Face-less single-path flame for dense campfires (41+ members). ~200 bytes each, no animation. */
export function FlameGlyph({ hue, size = 15, state }: { hue: number; size?: number; state: 'done' | 'going' | 'out' | 'legend' }) {
  const fill = state === 'out' ? '#9A948F' : state === 'legend' ? 'hsl(44 95% 56%)' : `hsl(${hue} 95% 58%)`;
  return (
    <svg className="fl-glyph" width={size} height={Math.round(size * 1.2)} viewBox="0 0 100 120" aria-hidden style={{ opacity: state === 'going' ? 0.55 : 1 }}>
      <path d={BODY.outer} fill={fill} stroke="var(--outline)" strokeWidth={10} />
    </svg>
  );
}
