"use client";

import clsx from "clsx";

import { formatDayLabel, formatMeetingCode, formatTimeRange, meetingEnd, meetingStart, startOfDay } from "@/lib/format";
import type { Meeting } from "@/lib/types";

interface MeetingListProps {
  meetings: Meeting[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  /** The Personal Meeting ID card pinned on top (Upcoming tab). */
  pmi?: Meeting;
  emptyText: string;
}

/** Left column of the Meetings tab: PMI card, then meetings grouped by day. */
export function MeetingList({ meetings, selectedId, onSelect, pmi, emptyText }: MeetingListProps) {
  const groups = groupByDay(meetings);

  return (
    <div className="flex flex-col gap-1 px-4 pb-4">
      {pmi && (
        <button
          type="button"
          onClick={() => onSelect(pmi.id)}
          className={clsx(
            "mb-2 rounded-lg px-4 py-4 text-center",
            selectedId === pmi.id ? "bg-zoom-blue text-white" : "bg-shell text-ink hover:bg-[#e6eaef]",
          )}
        >
          <p className="text-lg font-semibold">{formatMeetingCode(pmi.meeting_code)}</p>
          <p className={clsx("text-[13px]", selectedId === pmi.id ? "text-white/90" : "text-ink-2")}>
            My Personal Meeting ID (PMI)
          </p>
        </button>
      )}

      {groups.length === 0 && <p className="py-24 text-center text-[15px] text-ink-2">{emptyText}</p>}

      {groups.map(([label, items]) => (
        <section key={label}>
          <h3 className="px-2 pt-3 pb-1.5 text-xs font-semibold text-ink-3">{label}</h3>
          {items.map((m) => {
            const start = meetingStart(m);
            const end = meetingEnd(m);
            const selected = m.id === selectedId;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelect(m.id)}
                className={clsx(
                  "flex w-full flex-col rounded-lg px-3 py-2.5 text-left",
                  selected ? "bg-zoom-blue text-white" : "hover:bg-shell",
                )}
              >
                <span className={clsx("text-xs", selected ? "text-white/85" : "text-ink-2")}>
                  {start && end ? formatTimeRange(start, end) : ""}
                  {m.status === "live" && (
                    <span className={clsx("ml-2 font-semibold", selected ? "text-white" : "text-green-600")}>
                      ● Live
                    </span>
                  )}
                </span>
                <span className="truncate text-sm font-semibold">{m.title}</span>
                <span className={clsx("text-xs", selected ? "text-white/85" : "text-ink-3")}>
                  Meeting ID: {formatMeetingCode(m.meeting_code)}
                </span>
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}

function groupByDay(meetings: Meeting[]): [string, Meeting[]][] {
  const groups = new Map<string, Meeting[]>();
  for (const m of meetings) {
    const start = meetingStart(m);
    const label = start ? formatDayLabel(startOfDay(start)) : "Other";
    groups.set(label, [...(groups.get(label) ?? []), m]);
  }
  return [...groups.entries()];
}
