"use client";

import { SquareArrowOutUpRight, X } from "lucide-react";

import { toast } from "@/lib/toast";

/** Dark right-hand panel used by Participants and Chat. */
export function SidePanel({
  title,
  icon,
  onClose,
  children,
  footer,
}: {
  title: React.ReactNode;
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <aside className="absolute inset-0 z-30 flex flex-col bg-room-panel text-white md:static md:m-1 md:w-[400px] md:shrink-0 md:rounded-lg md:border md:border-room-line">
      <header className="relative flex h-12 shrink-0 items-center justify-center px-10">
        {icon && <span className="absolute left-3">{icon}</span>}
        <h2 className="truncate text-[15px] font-semibold">{title}</h2>
        <div className="absolute right-2 flex items-center">
          <button
            type="button"
            aria-label="Pop out"
            onClick={() => toast("Pop-out windows aren't available in the web client")}
            className="hidden rounded p-1 hover:bg-white/10 md:block"
          >
            <SquareArrowOutUpRight className="size-[18px]" />
          </button>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded p-1 hover:bg-white/10">
            <X className="size-5" />
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      {footer}
    </aside>
  );
}
