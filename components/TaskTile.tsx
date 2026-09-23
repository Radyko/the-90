'use client';
// Big 2-up task tile (Today). Optimistic: flips immediately, shows saving, rolls back with retry on error.
// Haptics: navigator.vibrate(12) on check, (8) on uncheck. Stoke: parent adds .fl-stoke to the hero flame.
import { Icon, type IconName } from './Icon';

export interface TaskTileProps {
  label: string;
  hint?: string;
  icon: IconName;
  done: boolean;
  saving?: boolean;
  error?: boolean;
  disabled?: boolean; // finished members, past days
  onToggle: () => void;
}

export function TaskTile({ label, hint, icon, done, saving, error, disabled, onToggle }: TaskTileProps) {
  return (
    <button
      type="button"
      className="tile"
      aria-pressed={done}
      aria-busy={saving || undefined}
      data-error={error || undefined}
      disabled={disabled}
      onClick={() => {
        if ('vibrate' in navigator) navigator.vibrate(done ? 8 : 12);
        onToggle();
      }}
    >
      <span className="tile__icon"><Icon name={icon} size={24} /></span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span className="tile__label">{label}</span>
        {error ? <span className="tile__hint" style={{ color: 'var(--danger)', fontWeight: 800 }}>Didn’t save. Tap to retry</span> : hint && <span className="tile__hint">{hint}</span>}
      </span>
      {done && (
        <span className="tile__check" aria-hidden>
          <svg width="26" height="26" viewBox="0 0 26 26"><circle cx="13" cy="13" r="12" fill="#1D1A17" /><path d="M7.5 13.5l3.5 3.5 7.5-8" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      )}
    </button>
  );
}
