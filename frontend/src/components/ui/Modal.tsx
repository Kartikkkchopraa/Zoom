"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import { useEffect } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  /** Dark styling for dialogs shown inside the meeting room. */
  tone?: "light" | "dark";
}

export function Modal({ open, onClose, title, children, footer, className, tone = "light" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const dark = tone === "dark";

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx(
          "w-full max-w-[420px] rounded-xl shadow-2xl",
          dark ? "border border-room-line bg-room-panel text-white" : "bg-white text-ink",
          className,
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-6 pt-5 pb-2">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className={clsx("rounded p-1", dark ? "text-white/70 hover:bg-white/10" : "text-ink-3 hover:bg-shell")}
            >
              <X className="size-4" />
            </button>
          </div>
        )}
        <div className="px-6 py-3">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-6 pt-2 pb-5">{footer}</div>}
      </div>
    </div>
  );
}
