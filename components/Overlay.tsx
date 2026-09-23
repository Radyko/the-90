"use client";
// Bottom sheet + centered dialog. Scrim click / Escape close; focus moves in and is
// restored on close; Tab is trapped inside.

import { useEffect, useRef } from "react";

type Props = { open: boolean; onClose: () => void; label: string; children: React.ReactNode };

function useModal(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = ref.current;
    const focusables = () =>
      Array.from(root?.querySelectorAll<HTMLElement>("button, [href], input, textarea, select, [tabindex]") ?? [])
        .filter((el) => !el.hasAttribute("disabled"));
    (root?.querySelector<HTMLElement>("[autofocus]") ?? focusables()[0] ?? root)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab") return;
      const els = focusables();
      if (!els.length) return;
      const [first, last] = [els[0], els[els.length - 1]];
      if (e.shiftKey && document.activeElement === first) (e.preventDefault(), last.focus());
      else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), first.focus());
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open, onClose]);
  return ref;
}

export function Sheet({ open, onClose, label, children }: Props) {
  const ref = useModal(open, onClose);
  if (!open) return null;
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div ref={ref} className="sheet" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
        <div className="sheet__grip" aria-hidden />
        {children}
      </div>
    </>
  );
}

export function Dialog({ open, onClose, label, children }: Props) {
  const ref = useModal(open, onClose);
  if (!open) return null;
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div ref={ref} className="dialog" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
        {children}
      </div>
    </>
  );
}
