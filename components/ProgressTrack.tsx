// "Your run" track. Readable from 7 to 365 cells.
//  ≤ 120 cells: dot grid, 15 per row (75 → 5 rows, 90 → 6 rows).
//  > 120 cells: 7-per-column week layout (like a contribution graph) in a horizontal scroller,
//               auto-scrolled so "today" is visible; month ticks above.
// Cell states never rely on color alone: today has a thick ring, last-out has a ring in danger color
// plus it's announced in the summary text.
import type { CSSProperties } from 'react';

export interface ProgressTrackProps {
  length: number;
  day: number; // current Day N
  todayComplete: boolean;
  lastOutDay?: number | null; // where the previous attempt died (shown as a target)
  labelledBy?: string;
}

export function ProgressTrack({ length, day, todayComplete, lastOutDay, labelledBy }: ProgressTrackProps) {
  const dense = length > 120;
  const cols = dense ? Math.ceil(length / 7) : Math.min(15, length);
  const cells = Array.from({ length }, (_, i) => {
    const d = i + 1;
    const state = d < day || (d === day && todayComplete) ? 'kept' : d === day ? 'today' : d === lastOutDay ? 'last-out' : 'future';
    return <span key={d} className="track__cell" data-state={state} />;
  });
  const style = { '--cols': cols } as CSSProperties;
  const summary = `Day ${day} of ${length}. ${day - (todayComplete ? 0 : 1)} days kept.${lastOutDay ? ` Last flame went out on day ${lastOutDay}.` : ''}`;
  return (
    <div role="img" aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : summary}>
      {dense ? (
        <div style={{ overflowX: 'auto', paddingBottom: 6 }}>
          <div className="track" style={{ ...style, gridTemplateRows: 'repeat(7, 10px)', gridAutoFlow: 'column', gridTemplateColumns: `repeat(${cols}, 10px)`, gap: 3 }}>{cells}</div>
        </div>
      ) : (
        <div className="track" style={style}>{cells}</div>
      )}
    </div>
  );
}
