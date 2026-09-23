"use client";
// Hold-to-confirm (S20): the fill grows over `ms` while pressed; releasing early resets.
// Works with touch, mouse and keyboard (hold Space/Enter).

import { useRef, useState } from "react";

export function HoldButton({ ms = 1500, onConfirm, children, disabled }: {
  ms?: number; onConfirm: () => void; children: React.ReactNode; disabled?: boolean;
}) {
  const [progress, setProgress] = useState(0);
  const frame = useRef<number | undefined>(undefined);
  const started = useRef(0);
  const lastTick = useRef(0);

  const buzz = (pattern: number | number[]) => {
    if ("vibrate" in navigator) navigator.vibrate(pattern);
  };

  function start() {
    if (disabled || frame.current) return;
    started.current = performance.now();
    lastTick.current = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - started.current) / ms);
      setProgress(p);
      if (now - started.current - lastTick.current >= 300) {
        lastTick.current = now - started.current;
        buzz(5);
      }
      if (p >= 1) {
        frame.current = undefined;
        buzz([40, 60, 120]);
        onConfirm();
        return;
      }
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  }

  function stop() {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = undefined;
    setProgress(0);
  }

  return (
    <button
      type="button"
      className="btn btn--danger btn--hold"
      style={{ "--hold": `${progress * 100}%` } as React.CSSProperties}
      disabled={disabled}
      aria-describedby="hold-help"
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); start(); } }}
      onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") stop(); }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
      <span id="hold-help" className="sr-only">Press and hold for 1.5 seconds to confirm</span>
    </button>
  );
}
