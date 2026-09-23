// Clan campfire: members' flames around a shared fire whose size = share of members done today.
// Scales 2 → 100+ (see "Campfire · 2 / 8 / 30 / 100" artboard):
//   2–6   one arc, 56–40px faces      7–20  one ring, 32–40px
//   21–40 two rings, 24px             41+   up to 3 rings of FlameGlyph at 15px (no faces, no animation)
import { Flame, FlameGlyph } from './Flame';
import { stageFor } from '@/lib/flame';

export interface CampfireMember {
  id: string;
  hue: number;
  day: number;
  state: 'done' | 'going' | 'out' | 'legend';
}

export function Campfire({ members, length, width = 326, height = 200 }: { members: CampfireMember[]; length: number; width?: number; height?: number }) {
  const n = members.length;
  const doneShare = n ? members.filter((m) => m.state === 'done' || m.state === 'legend').length / n : 0;
  const size = n <= 2 ? 56 : n <= 6 ? 40 : n <= 20 ? 32 : n <= 40 ? 24 : 15;
  const rings = n <= 20 ? 1 : n <= 40 ? 2 : 3;
  const cx = width / 2, cy = height * 0.6, rx = width * 0.44, ry = height * 0.38;
  const per = Math.ceil(n / rings);

  const fireK = 0.45 + 0.55 * doneShare;
  const fireW = 120;
  const d = `M60 ${100 - 88 * fireK} C${60 + 10 * fireK} ${100 - 64 * fireK} ${60 + 38 * fireK} ${100 - 50 * fireK} ${60 + 38 * fireK} ${100 - 22 * fireK} C${60 + 38 * fireK} 97 ${60 + 18 * fireK} 100 60 100 C${60 - 18 * fireK} 100 ${60 - 38 * fireK} 97 ${60 - 38 * fireK} ${100 - 22 * fireK} C${60 - 38 * fireK} ${100 - 50 * fireK} ${60 - 14 * fireK} ${100 - 58 * fireK} 60 ${100 - 88 * fireK} Z`;

  return (
    <div role="img" aria-label={`${Math.round(doneShare * n)} of ${n} members done today`} style={{ position: 'relative', width: '100%', maxWidth: width, height, marginInline: 'auto' }}>
      <svg width={fireW} height={110} viewBox="0 0 120 110" aria-hidden style={{ position: 'absolute', left: cx - fireW / 2, top: cy - 68 }}>
        <ellipse cx="60" cy="102" rx="54" ry="8" style={{ fill: 'var(--sky)' }} />
        <path d={d} fill="#FF7A2F" stroke="var(--outline)" strokeWidth="3" strokeLinejoin="round" paintOrder="stroke" style={{ transition: 'd 420ms cubic-bezier(.2,1.4,.4,1)' }} />
        <rect x="22" y="92" width="76" height="12" rx="6" fill="#A8683C" stroke="#6E3F1F" strokeWidth="2" transform="rotate(-8 60 98)" />
        <rect x="22" y="92" width="76" height="12" rx="6" fill="#8A5230" stroke="#6E3F1F" strokeWidth="2" transform="rotate(8 60 98)" />
      </svg>
      {members.map((m, i) => {
        const r = Math.floor(i / per), k = i % per, inRing = Math.min(per, n - r * per);
        const f = 1 - r * 0.22;
        const a = inRing > 6 ? (2 * Math.PI * (k + 0.5)) / inRing - Math.PI / 2 : Math.PI * (1 + (k + 0.5) / inRing);
        const x = cx + rx * f * Math.cos(a) - size / 2, y = cy + ry * f * Math.sin(a) - size * 0.6;
        return (
          <span key={m.id} style={{ position: 'absolute', left: x, top: y }}>
            {n > 40 ? (
              <FlameGlyph hue={m.hue} size={size} state={m.state} />
            ) : (
              <Flame hue={m.hue} size={size} static
                stage={m.state === 'legend' ? 'phoenix' : stageFor(m.day, length, false)}
                mood={m.state === 'out' ? 'dead' : m.state === 'going' ? 'half' : 'full'}
                energy={m.state === 'going' ? 0.5 : 1}
                gear={m.state === 'legend' ? 'crown' : 'none'} />
            )}
          </span>
        );
      })}
    </div>
  );
}
