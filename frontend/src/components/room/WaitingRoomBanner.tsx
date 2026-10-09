"use client";

import { X } from "lucide-react";
import { useState } from "react";

import { roomActions } from "@/lib/meeting/actions";
import { useRoom } from "@/lib/meeting/room";

/**
 * "<name> entered the waiting room  View  Admit  ×" — Zoom's prompt for hosts
 * and co-hosts. Closing it hides it until someone new arrives; it stays out of
 * the way while the Participants panel (which lists the waiting room) is open.
 */
export function WaitingRoomBanner() {
  const waitingList = useRoom((s) => s.waitingList);
  const panel = useRoom((s) => s.panel);
  const setPanel = useRoom((s) => s.setPanel);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());

  const pending = waitingList.filter((w) => !dismissed.has(w.id));
  if (!pending.length || panel === "participants") return null;
  const single = waitingList.length === 1;

  return (
    <div
      role="status"
      className="absolute top-3 left-1/2 z-30 flex max-w-[calc(100%-24px)] -translate-x-1/2 items-center gap-2 rounded-lg bg-black py-2 pr-2 pl-4 text-sm shadow-[0_2px_12px_rgba(0,0,0,0.5)]"
    >
      <span className="min-w-0 truncate pr-1">
        {single ? `${waitingList[0].name} entered the waiting room` : `${waitingList.length} people are in the waiting room`}
      </span>
      <button type="button" onClick={() => setPanel("participants")} className="shrink-0 rounded-md bg-room-control px-3.5 py-1 text-xs hover:bg-[#3a3b3e]">
        View
      </button>
      <button
        type="button"
        onClick={() => roomActions.admit(single ? waitingList[0].id : undefined)}
        className="shrink-0 rounded-md bg-zoom-blue px-3.5 py-1 text-xs font-semibold hover:bg-zoom-blue-hover"
      >
        {single ? "Admit" : "Admit all"}
      </button>
      <button
        type="button"
        aria-label="Close"
        onClick={() => setDismissed(new Set(waitingList.map((w) => w.id)))}
        className="shrink-0 rounded p-1 hover:bg-white/10"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
