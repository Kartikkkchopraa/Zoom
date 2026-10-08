"use client";

import { Copy, Info, LayoutGrid, ShieldCheck, Sparkles, Square } from "lucide-react";
import { useState } from "react";

import { MenuItem, Popover } from "@/components/ui/Popover";
import { copyText } from "@/lib/clipboard";
import { formatMeetingCode } from "@/lib/format";
import { useRoom } from "@/lib/meeting/room";
import { toast } from "@/lib/toast";

import { ShareBanner } from "./ShareBanner";
import type { MeetingRoom } from "@/lib/types";

/** Top bar of the meeting: "ⓘ Title" (info popover) and the view switcher. */
export function RoomHeader({ meeting, participantId }: { meeting: MeetingRoom; participantId: string }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const view = useRoom((s) => s.view);
  const setView = useRoom((s) => s.setView);

  return (
    <div className="relative flex h-12 shrink-0 items-center justify-between bg-room-bar px-3 text-white">
      <div className="absolute top-1/2 left-1/2 z-30 -translate-x-1/2 -translate-y-1/2 max-md:hidden">
        <ShareBanner />
      </div>
      <Popover
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        tone="dark"
        className="w-[400px] max-w-[calc(100vw-24px)] px-7 py-5"
        anchor={
          <button
            type="button"
            onClick={() => setInfoOpen((o) => !o)}
            className="flex items-center gap-2 rounded px-1.5 py-1 text-sm font-semibold hover:bg-white/10"
          >
            <Info className="size-4" /> <span className="max-w-[50vw] truncate">{meeting.title}</span>
          </button>
        }
      >
        <MeetingInfo meeting={meeting} participantId={participantId} />
      </Popover>

      <div className="flex items-center gap-3">
        <span title="Enhanced encryption" className="text-[#23d959]">
          <ShieldCheck className="size-[18px] fill-[#23d959] text-room-bar" />
        </span>
        <button
          type="button"
          aria-label="AI Companion"
          onClick={() => toast("AI Companion isn't available in this demo")}
          className="rounded p-1 hover:bg-white/10"
        >
          <Sparkles className="size-[18px]" strokeWidth={1.6} />
        </button>
        <span className="h-6 w-px bg-white/25" />
        <Popover
          open={viewOpen}
          onClose={() => setViewOpen(false)}
          tone="dark"
          align="right"
          className="w-44"
          anchor={
            <button
              type="button"
              aria-label="View"
              onClick={() => setViewOpen((o) => !o)}
              className="rounded p-1 hover:bg-white/10"
            >
              <LayoutGrid className="size-[18px] fill-current" />
            </button>
          }
        >
          <MenuItem tone="dark" onClick={() => (setView("speaker"), setViewOpen(false))}>
            <Square className="size-4" /> Speaker {view === "speaker" && "✓"}
          </MenuItem>
          <MenuItem tone="dark" onClick={() => (setView("gallery"), setViewOpen(false))}>
            <LayoutGrid className="size-4" /> Gallery {view === "gallery" && "✓"}
          </MenuItem>
        </Popover>
      </div>
    </div>
  );
}

function MeetingInfo({ meeting, participantId }: { meeting: MeetingRoom; participantId: string }) {
  const rows: [string, React.ReactNode][] = [
    [
      "Invite Link",
      <span key="link" className="flex min-w-0 items-center gap-2">
        <span className="truncate text-[#5c8dff]">{meeting.invite_link}</span>
        <button
          type="button"
          aria-label="Copy invite link"
          onClick={() => copyText(meeting.invite_link, "Invite link copied")}
          className="shrink-0 rounded-md border border-white/30 p-1 hover:bg-white/10"
        >
          <Copy className="size-3.5" />
        </button>
      </span>,
    ],
    ["Meeting ID", formatMeetingCode(meeting.meeting_code)],
    ["Host", `${meeting.host.name}${meeting.is_host ? " (You)" : ""}`],
    ["Passcode", meeting.passcode ?? "—"],
    ["Participant ID", participantId],
  ];
  return (
    <div>
      <h3 className="mb-4 text-base font-semibold">{meeting.title}</h3>
      <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-2 gap-y-2.5 text-[13px]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-room-text-2">{label}</dt>
            <dd className="min-w-0">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
