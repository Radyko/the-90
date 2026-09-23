// Mon–Sun strip under the big streak number. Uses the viewer's locale for day letters and first day of week.
// States come from member.log + the death day (if the run restarted this week).
import { Icon } from './Icon';

export type WeekDotState = 'kept' | 'today' | 'today-kept' | 'died' | 'future' | 'before-run';

export function WeekStrip({ days, locale }: { days: { date: Date; state: WeekDotState }[]; locale: string }) {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
  const full = new Intl.DateTimeFormat(locale, { weekday: 'long' });
  return (
    <ol className="week" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {days.map(({ date, state }) => (
        <li key={date.toISOString()} className="week__day" aria-label={`${full.format(date)}: ${state.replace('-', ' ')}`}>
          <span aria-hidden style={state.startsWith('today') ? { color: 'var(--ink)' } : undefined}>{fmt.format(date)}</span>
          <span className="week__dot" data-state={state === 'before-run' ? 'future' : state}>
            {(state === 'kept' || state === 'today-kept') && <Icon name="check" size={16} strokeWidth={3.6} />}
            {state === 'died' && <Icon name="x" size={14} strokeWidth={3} />}
          </span>
        </li>
      ))}
    </ol>
  );
}
