"use client";

import clsx from "clsx";
import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";

import { MenuItem, Popover } from "@/components/ui/Popover";
import { formatMeetingCode } from "@/lib/format";
import { useMeetingPrefs } from "@/lib/prefs";

import { JoinGlyph, ScheduleGlyph, VideoOffGlyph } from "./ActionIcons";

interface HomeActionsProps {
  pmi?: string;
  busy?: boolean;
  onNewMeeting: () => void;
  onJoin: () => void;
  onSchedule: () => void;
}

/** The three round-square buttons under the clock: New meeting ▾, Join, Schedule. */
export function HomeActions({ pmi, busy, onNewMeeting, onJoin, onSchedule }: HomeActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { startWithVideo, usePmi, set } = useMeetingPrefs();

  return (
    <div className="flex items-start justify-center gap-10 sm:gap-[60px]">
      <ActionTile
        color="orange"
        label="New meeting"
        onClick={onNewMeeting}
        disabled={busy}
        caption={
          <Popover
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            align="center"
            className="w-72"
            anchor={
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="mt-2 flex items-center gap-1 rounded px-1 text-sm text-ink-2 hover:text-ink"
              >
                New meeting <ChevronDown className="size-3.5" />
              </button>
            }
          >
            <MenuItem onClick={() => set({ startWithVideo: !startWithVideo })}>
              <CheckSlot checked={startWithVideo} />
              Start with video
            </MenuItem>
            <MenuItem onClick={() => set({ usePmi: !usePmi })}>
              <CheckSlot checked={usePmi} />
              <span>
                Use my Personal Meeting ID (PMI)
                {pmi && <span className="block text-xs text-ink-3">{formatMeetingCode(pmi)}</span>}
              </span>
            </MenuItem>
          </Popover>
        }
      >
        <VideoOffGlyph />
      </ActionTile>

      <ActionTile color="blue" label="Join" onClick={onJoin}>
        <JoinGlyph />
      </ActionTile>
      <ActionTile color="blue" label="Schedule" onClick={onSchedule}>
        <ScheduleGlyph />
      </ActionTile>
    </div>
  );
}

function CheckSlot({ checked }: { checked: boolean }) {
  return (
    <span className="flex w-4 shrink-0 justify-center">
      {checked && <Check className="size-4 text-zoom-blue" />}
    </span>
  );
}

function ActionTile({
  color,
  label,
  onClick,
  disabled,
  caption,
  children,
}: {
  color: "orange" | "blue";
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Replaces the plain text label (New meeting uses a ▾ menu). */
  caption?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-14 flex-col items-center whitespace-nowrap">
      {/* The button stays put and only the tile inside lifts, so a pointer near its
          edge can't fall off the lifted tile and make it bounce. */}
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
        className="group size-14 rounded-2xl outline-none disabled:opacity-60"
      >
        <span
          className={clsx(
            "flex size-full items-center justify-center rounded-2xl transition-[transform,box-shadow] duration-200 ease-out",
            "group-hover:-translate-y-0.5 group-hover:shadow-[0_6px_12px_rgba(0,0,0,0.22)] group-focus-visible:-translate-y-0.5 group-focus-visible:shadow-[0_6px_12px_rgba(0,0,0,0.22)]",
            "group-disabled:translate-y-0 group-disabled:shadow-none",
            color === "orange" ? "bg-zoom-orange" : "bg-zoom-blue",
          )}
        >
          {children}
        </span>
      </button>
      {caption ?? <span className="mt-2 text-sm text-ink-2">{label}</span>}
    </div>
  );
}
