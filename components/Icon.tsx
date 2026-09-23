// Custom 24px stroke icon set (round caps/joins, 2–2.2 stroke). currentColor by default.
// Never use emoji as UI icons.
const P = {
  today: 'M12 2.5c1.2 3.2 5.5 5.3 5.5 10.5a5.5 5.5 0 0 1-11 0c0-3 2-4.3 2.4-6.6 1 1.3 2 1.8 2.6 1.6-.8-2.1-.5-3.9.5-5.5z',
  clan: 'M5 20.5l14-3.5M19 20.5L5 17M12 15c-2.2-1.5-2.5-3.7 0-7 2.5 3.3 2.2 5.5 0 7zM4.5 8.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 1 0 0-3.6M19.5 8.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 1 0 0-3.6',
  ranks: 'M3 20h18M4.5 20v-6h5v6M9.5 20V9h5v11M14.5 20v-8h5v8',
  me: 'M12 4a4 4 0 1 0 0 8 4 4 0 1 0 0-8M4.5 20.5c1.5-3.8 4.3-5.5 7.5-5.5s6 1.7 7.5 5.5',
  phone: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2M4 4l16 16',
  move: 'M14 4.5a1.5 1.5 0 1 0 0-.01M9 21l2.5-6.5 3 2.5V21M6 12l3-4 4 1 2 3 3 1M11.5 14.5L9 8',
  book: 'M4 5h6a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6z',
  code: 'M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14',
  water: 'M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z',
  food: 'M7 3v8a2 2 0 0 0 4 0V3M9 11v10M17 3c-2 0-3 2-3 5s1 4 3 4v9',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 9.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 1 0 0-7',
  task: 'M5 12.5l4.5 4.5L19 7.5',
  lock: 'M5 11h14v10H5zM8 11V8a4 4 0 0 1 8 0v3',
  copy: 'M8 8h12v12H8zM16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3',
  share: 'M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  mail: 'M3 5h18v14H3zM4 7l8 6 8-6',
  wifiOff: 'M2 8.5a15 15 0 0 1 5-3M22 8.5A15 15 0 0 0 12 5M5 12.5a10 10 0 0 1 4-2.2M19 12.5a10 10 0 0 0-3-1.8M8.5 16a5 5 0 0 1 7 0M12 19.5h.01M3 3l18 18',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6',
  chevron: 'M9 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  back: 'M15 6l-6 6 6 6',
  pencil: 'M4 20h4L19 9l-4-4L4 16z',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  crown: 'M4 18h16l-1.5-10-4.5 4-2-6-2 6-4.5-4z',
  trophy: 'M7 3h10v5a5 5 0 0 1-10 0V3zM9 17h6v4H9zM12 13v4M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18M12 7v5l3 2',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2M18 14h2v2M14 18h2v2M18 18h2v2',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0',
  users: 'M8 6a3 3 0 1 0 0 6 3 3 0 1 0 0-6M16 6a3 3 0 1 0 0 6 3 3 0 1 0 0-6M2.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5M10.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  match: 'M6 20L18 8M19 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 1 0 0-5',
} as const;

export type IconName = keyof typeof P;

export function Icon({ name, size = 22, strokeWidth = 2.2, className }: { name: IconName; size?: number; strokeWidth?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={P[name]} />
    </svg>
  );
}
