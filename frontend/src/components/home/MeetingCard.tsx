import clsx from "clsx";

import { Avatar } from "@/components/ui/Avatar";
import { formatTimeRange, meetingEnd, meetingStart } from "@/lib/format";
import type { Meeting } from "@/lib/types";

export type MeetingAction = "start" | "join";

interface MeetingCardProps {
  meeting: Meeting;
  currentUserId?: number;
  onAction: (meeting: Meeting, action: MeetingAction) => void;
  /** Prefix the time with the day (used outside the single-day view). */
  showDate?: boolean;
}

/** A meeting block in the Home calendar (the light-blue card in Zoom). */
export function MeetingCard({ meeting, currentUserId, onAction, showDate }: MeetingCardProps) {
  const start = meetingStart(meeting);
  const end = meetingEnd(meeting);
  const ended = meeting.status === "ended";
  const isHost = meeting.host.id === currentUserId;
  const action: MeetingAction = isHost && meeting.status !== "live" ? "start" : "join";
  const joined = meeting.participant_count;

  return (
    <div
      className={clsx(
        "rounded-lg border px-2.5 py-2",
        ended ? "border-line bg-[#f7f8fa]" : "border-[#afcaf6] bg-[#f3f8ff]",
      )}
    >
      <p className={clsx("text-[15px] font-semibold", ended ? "text-ink-2" : "text-ink")}>
        {meeting.title}
      </p>
      {joined > 0 && (
        <p className="text-[11px] font-semibold text-ink">
          {joined} {joined === 1 ? "person" : "people"} joined
        </p>
      )}
      {start && end && (
        <p className="mt-0.5 text-[13px] text-ink-2">
          {showDate && `${start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · `}
          {formatTimeRange(start, end)}
        </p>
      )}
      <p className="text-[13px] text-ink-2">Host: {meeting.host.name}</p>

      <div className="mt-1.5 flex items-center gap-1">
        <Avatar
          name={meeting.host.name}
          initials={meeting.host.initials}
          color={meeting.host.avatar_color}
          variant="soft"
          size={24}
        />
        {meeting.invitees.length > 0 && (
          <span className="ml-0.5 text-xs text-ink-3">+{meeting.invitees.length} invited</span>
        )}
      </div>

      <div className="mt-2">
        {ended ? (
          <span className="text-xs text-ink-3">Ended</span>
        ) : (
          <button
            type="button"
            onClick={() => onAction(meeting, action)}
            className="rounded-md bg-zoom-blue px-2.5 py-1 text-xs font-medium text-white hover:bg-zoom-blue-hover"
          >
            {action === "start" ? "Start" : "Join"}
          </button>
        )}
      </div>
    </div>
  );
}
