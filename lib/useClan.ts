"use client";
// Live data for one clan: the server-computed board and the feed.
// Refetches on realtime changes (debounced) and when the tab comes back.

import { useCallback, useEffect, useRef, useState } from "react";
import { clanBoard, clanEvents, subscribeToClan } from "./api";
import type { BoardRow, ClanEvent } from "./types";

export function useClan(clanId: string | null | undefined, enabled = true) {
  const [board, setBoard] = useState<BoardRow[] | null>(null);
  const [events, setEvents] = useState<ClanEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const reload = useCallback(async () => {
    if (!clanId || !enabled) return;
    try {
      const [b, e] = await Promise.all([clanBoard(clanId), clanEvents(clanId)]);
      setBoard(b);
      setEvents(e);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [clanId, enabled]);

  useEffect(() => {
    setBoard(null);
    setEvents(null);
    if (!clanId || !enabled) return;
    reload();
    const unsubscribe = subscribeToClan(clanId, () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(reload, 250);
    });
    const onVisible = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      unsubscribe();
      clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [clanId, enabled, reload]);

  return { board, events, error, reload };
}
