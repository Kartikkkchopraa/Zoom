"use client";

import { useEffect, useState } from "react";

const IDLE_MS = 3000;

/**
 * Zoom hides the meeting header and toolbar when the mouse stops moving and
 * brings them back on any movement, tap or key press. They stay up while the
 * pointer is over a bar ([data-room-bar]) or one of its menus is open, and
 * whenever `pinned` (e.g. not joined yet, or the End bar is showing).
 */
export function useIdleControls(container: React.RefObject<HTMLElement | null>, pinned: boolean): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const root = container.current;
    // The browser test suite sets this so idle waits don't hide what it clicks next.
    const keep = (window as { __keepRoomControls?: boolean }).__keepRoomControls;
    if (!root || pinned || keep) {
      setVisible(true);
      return;
    }
    let timer: number | undefined;
    const busy = () =>
      [...root.querySelectorAll("[data-room-bar]")].some((bar) => bar.matches(":hover") || bar.querySelector("[data-popover]"));
    const hideLater = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => (busy() ? hideLater() : setVisible(false)), IDLE_MS);
    };
    const wake = () => {
      setVisible(true);
      hideLater();
    };
    const events = ["pointermove", "pointerdown", "keydown"] as const;
    events.forEach((e) => root.addEventListener(e, wake));
    hideLater();
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => root.removeEventListener(e, wake));
    };
  }, [container, pinned]);

  return visible;
}
