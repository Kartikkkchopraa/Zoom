"use client";

import clsx from "clsx";
import { useEffect, useRef } from "react";

type Tone = "light" | "dark";

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  /** The element the popover is anchored to (rendered inline, always visible). */
  anchor: React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  /** "top" opens upward (used by the meeting toolbar). */
  side?: "bottom" | "top";
  tone?: Tone;
  className?: string;
}

/** A dropdown panel that closes on outside click or Escape. */
export function Popover({
  open,
  onClose,
  anchor,
  children,
  align = "left",
  side = "bottom",
  tone = "light",
  className,
}: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <div ref={ref} className="relative inline-flex">
      {anchor}
      {open && (
        <div
          className={clsx(
            "absolute z-50 rounded-xl border py-1.5",
            side === "bottom" ? "top-full mt-2" : "bottom-full mb-2",
            align === "left" && "left-0",
            align === "right" && "right-0",
            align === "center" && "left-1/2 -translate-x-1/2",
            tone === "light"
              ? "border-line bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
              : "border-room-line bg-room-panel text-white shadow-[0_8px_24px_rgba(0,0,0,0.5)]",
            className,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  children,
  onClick,
  disabled,
  tone = "light",
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: Tone;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm disabled:hover:bg-transparent",
        tone === "light"
          ? "text-ink hover:bg-shell disabled:text-ink-3"
          : "text-white hover:bg-white/10 disabled:text-white/40",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function MenuLabel({ children, tone = "light" }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <p className={clsx("px-4 pt-2 pb-1 text-xs font-semibold", tone === "light" ? "text-ink-3" : "text-room-text-2")}>
      {children}
    </p>
  );
}

export function MenuDivider({ tone = "light" }: { tone?: Tone }) {
  return <div className={clsx("my-1 h-px", tone === "light" ? "bg-line" : "bg-room-line")} />;
}
