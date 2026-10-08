"use client";

import clsx from "clsx";
import { useEffect, useRef } from "react";

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  /** The element the popover is anchored to (rendered inline, always visible). */
  anchor: React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}

/** A dropdown panel that closes on outside click or Escape. */
export function Popover({ open, onClose, anchor, children, align = "left", className }: PopoverProps) {
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
            "absolute top-full z-50 mt-2 rounded-xl border border-line bg-white py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.12)]",
            align === "left" && "left-0",
            align === "right" && "right-0",
            align === "center" && "left-1/2 -translate-x-1/2",
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
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-ink hover:bg-shell disabled:text-ink-3 disabled:hover:bg-transparent",
        className,
      )}
    >
      {children}
    </button>
  );
}
