"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { formatMeetingCode, meetingStart } from "@/lib/format";
import type { ConnectionStatus } from "@/lib/meeting/room";
import type { MeetingRoom } from "@/lib/types";

/**
 * Full-stage screens for every state other than "in the meeting":
 * connecting, waiting for the host, ended, and connection errors.
 */
export function RoomStatus({
  status,
  message,
  meeting,
  onLeave,
  onRejoin,
}: {
  status: ConnectionStatus;
  message: string | null;
  meeting: MeetingRoom;
  onLeave: () => void;
  onRejoin: () => void;
}) {
  if (status === "joined") return null;

  if (status === "connecting") {
    return (
      <Overlay>
        <Loader2 className="size-8 animate-spin text-white/70" />
        <p className="text-sm text-white/70">Connecting to the meeting…</p>
      </Overlay>
    );
  }

  if (status === "waiting_host") {
    const start = meetingStart(meeting);
    return (
      <Overlay>
        <p className="text-lg font-semibold">Please wait for the host to start this meeting.</p>
        <div className="text-center text-sm text-white/70">
          <p className="text-base text-white">{meeting.title}</p>
          {start && meeting.meeting_type === "scheduled" && (
            <p>
              {start.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>
          )}
          <p>Meeting ID: {formatMeetingCode(meeting.meeting_code)}</p>
        </div>
        <p className="text-xs text-white/50">You&apos;ll join automatically as soon as the host arrives.</p>
        <Button variant="dark" onClick={onLeave}>
          Leave
        </Button>
      </Overlay>
    );
  }

  return (
    <Overlay>
      <p className="max-w-md text-center text-lg">{message ?? "The meeting connection was lost."}</p>
      <div className="flex gap-2">
        {status === "error" && (
          <Button variant="dark" onClick={onRejoin}>
            Rejoin
          </Button>
        )}
        <Button onClick={onLeave}>{status === "ended" ? "OK" : "Leave"}</Button>
      </div>
    </Overlay>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-room px-6 text-white">
      {children}
    </div>
  );
}
