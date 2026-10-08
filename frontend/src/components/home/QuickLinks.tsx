"use client";

import { FileText, NotebookPen, type LucideIcon } from "lucide-react";

import { toast } from "@/lib/toast";

function RecordIcon() {
  return (
    <span className="flex size-4 items-center justify-center rounded-full border-[1.5px] border-zoom-red">
      <span className="size-2 rounded-full bg-zoom-red" />
    </span>
  );
}

const LINKS: { label: string; tint: string; icon: LucideIcon | null }[] = [
  { label: "Recordings", tint: "#fdecec", icon: null },
  { label: "Summaries", tint: "#f1edfd", icon: FileText },
  { label: "My Notes", tint: "#f1edfd", icon: NotebookPen },
];

/** Recordings / Summaries / My Notes cards (placeholders — outside the assignment scope). */
export function QuickLinks() {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-4">
      {LINKS.map(({ label, tint, icon: Icon }) => (
        <button
          key={label}
          type="button"
          onClick={() => toast(`${label} aren't available in this demo`)}
          className="flex h-14 items-center gap-3 rounded-xl border border-line bg-white px-3 text-left text-sm font-semibold text-ink hover:bg-[#fafbfc] sm:px-4 sm:text-[15px]"
        >
          <span
            className="hidden size-8 shrink-0 items-center justify-center rounded-lg sm:flex"
            style={{ background: tint }}
          >
            {Icon ? <Icon className="size-4 text-[#7a5af5]" strokeWidth={1.8} /> : <RecordIcon />}
          </span>
          {label}
        </button>
      ))}
    </div>
  );
}
