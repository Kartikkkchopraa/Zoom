"use client";

import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Ellipsis, Info, SquareArrowOutUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { MiniCalendar } from "@/components/ui/MiniCalendar";
import { MenuItem, Popover } from "@/components/ui/Popover";
import { addDays, formatDayLabel, isSameDay, meetingStart, startOfDay } from "@/lib/format";
import { useCalendarDay, useMeetings } from "@/lib/queries";
import { toast } from "@/lib/toast";
import type { Meeting } from "@/lib/types";

import { BeachIllustration } from "./BeachIllustration";
import { MeetingCard, type MeetingAction } from "./MeetingCard";

interface CalendarPanelProps {
  currentUserId?: number;
  onAction: (meeting: Meeting, action: MeetingAction) => void;
}

/**
 * Zoom's Home calendar: a day view with day navigation, followed by the next
 * upcoming meetings after the selected day.
 */
export function CalendarPanel({ currentUserId, onAction }: CalendarPanelProps) {
  const router = useRouter();
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: dayMeetings, isPending } = useCalendarDay(day);
  const { data: upcoming } = useMeetings("upcoming");

  const later = (upcoming ?? [])
    .filter((m) => {
      const start = meetingStart(m);
      return start && start >= addDays(day, 1);
    })
    .slice(0, 5);

  return (
    <section className="flex flex-col rounded-lg border border-line">
      <div className="m-2 flex gap-3 rounded-lg border border-[#afcaf6] bg-[#fafcff] px-4 py-3.5 text-sm text-ink">
        <Info className="mt-0.5 size-[18px] shrink-0 text-zoom-blue" strokeWidth={1.8} />
        <p>
          You haven&apos;t connected your calendar yet.{" "}
          <button
            type="button"
            className="text-zoom-blue hover:underline"
            onClick={() => toast("Calendar integration isn't available in this demo")}
          >
            Connect now
          </button>{" "}
          to manage all your meetings and events in one place.
        </p>
      </div>

      <div className="relative flex h-12 items-center justify-center border-b border-line">
        <Popover
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          align="center"
          anchor={
            <button
              type="button"
              onClick={() => setPickerOpen((o) => !o)}
              className="flex items-center gap-1 rounded px-2 py-1 text-[15px] font-semibold hover:bg-shell"
            >
              {formatDayLabel(day)} <ChevronDown className="size-4" />
            </button>
          }
        >
          <MiniCalendar
            value={day}
            onChange={(d) => {
              setDay(startOfDay(d));
              setPickerOpen(false);
            }}
          />
        </Popover>
        <button
          type="button"
          aria-label="Open in Meetings"
          title="Open in Meetings"
          onClick={() => router.push("/meetings")}
          className="absolute right-4 rounded p-1 text-ink-2 hover:bg-shell"
        >
          <SquareArrowOutUpRight className="size-4" />
        </button>
      </div>

      <div className="flex h-11 items-center gap-2 border-b border-line px-4">
        <button
          type="button"
          onClick={() => setDay(startOfDay(new Date()))}
          className="flex items-center gap-1 rounded-full border border-ink-3/60 px-2 py-0.5 text-xs hover:bg-shell"
        >
          <CalendarDays className="size-3" /> Today
        </button>
        <button
          type="button"
          aria-label="Previous day"
          onClick={() => setDay(addDays(day, -1))}
          className="rounded p-1 hover:bg-shell"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Next day"
          onClick={() => setDay(addDays(day, 1))}
          className="rounded p-1 hover:bg-shell"
        >
          <ChevronRight className="size-4" />
        </button>
        <div className="ml-auto">
          <Popover
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            align="right"
            className="w-52"
            anchor={
              <button
                type="button"
                aria-label="More options"
                onClick={() => setMenuOpen((o) => !o)}
                className="rounded p-1 text-ink-2 hover:bg-shell"
              >
                <Ellipsis className="size-4" />
              </button>
            }
          >
            <MenuItem onClick={() => router.push("/meetings")}>Open Meetings</MenuItem>
            <MenuItem onClick={() => router.push("/meetings?tab=previous")}>
              View previous meetings
            </MenuItem>
          </Popover>
        </div>
      </div>

      <div className="flex min-h-[320px] flex-col gap-2 p-4">
        {isPending ? (
          <CardSkeleton />
        ) : dayMeetings && dayMeetings.length > 0 ? (
          dayMeetings.map((m) => (
            <MeetingCard key={m.id} meeting={m} currentUserId={currentUserId} onAction={onAction} />
          ))
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-10">
            <BeachIllustration />
            <p className="text-[15px] text-ink-2">
              {isSameDay(day, new Date()) ? "No meetings scheduled." : "No meetings on this day."}
            </p>
          </div>
        )}
      </div>

      {later.length > 0 && (
        <div className="border-t border-line px-4 pt-3 pb-4">
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-ink-3 uppercase">
            Upcoming meetings
          </h3>
          <div className="flex flex-col gap-2">
            {later.map((m) => (
              <MeetingCard
                key={m.id}
                meeting={m}
                currentUserId={currentUserId}
                onAction={onAction}
                showDate
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function CardSkeleton() {
  return (
    <>
      {[0, 1].map((i) => (
        <div key={i} className="h-[120px] animate-pulse rounded-lg bg-shell" />
      ))}
    </>
  );
}
