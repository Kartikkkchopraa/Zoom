"use client";

import { useEffect, useState } from "react";

/**
 * The current time, refreshed every `intervalMs`. Returns null during server
 * render and the first client render so the markup matches (no hydration mismatch).
 */
export function useNow(intervalMs = 1000): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** False on the server and first client render, true after hydration. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
