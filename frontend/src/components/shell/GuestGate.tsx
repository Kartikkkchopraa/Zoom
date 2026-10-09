"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

import { useGuestEntry } from "@/lib/useGuestEntry";

/**
 * A meeting room URL (/wc/...) opened directly in a browser with no session,
 * e.g. pasted from another browser's address bar, joins as a guest. Hold the
 * shell back until that's settled: its profile request would otherwise sign
 * the browser in as the default user. Only the first page load is checked.
 */
export function GuestGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [roomEntry] = useState(() => pathname.startsWith("/wc/"));
  const ready = useGuestEntry(roomEntry);
  return ready ? children : <div className="h-dvh bg-room" />;
}
