"use client";

import { Checkbox } from "@/components/ui/Form";

/** Replaces the toolbar after clicking End: "End Meeting for All" / "Leave Meeting". */
export function EndMeetingBar({
  isHost,
  busy,
  onEndForAll,
  onLeave,
  onCancel,
}: {
  isHost: boolean;
  busy: boolean;
  onEndForAll: () => void;
  onLeave: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <div className="absolute right-3 bottom-[68px] z-40 flex w-[216px] flex-col gap-2">
        {isHost && (
          <button
            type="button"
            disabled={busy}
            onClick={onEndForAll}
            className="h-8 rounded-md bg-zoom-end text-sm text-white hover:bg-[#a72e23] disabled:opacity-60"
          >
            End Meeting for All
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={onLeave}
          className="h-8 rounded-md bg-[#2c2d2d] text-sm text-white hover:bg-[#3a3b3b] disabled:opacity-60"
        >
          Leave Meeting
        </button>
      </div>
      <div className="flex h-16 shrink-0 items-center justify-end gap-4 bg-room-bar px-3 text-white">
        <Checkbox label={<span className="text-sm text-white">Give feedback</span>} />
        <button
          type="button"
          autoFocus
          onClick={onCancel}
          className="h-8 rounded-md bg-[#0b0b0b] px-3 text-sm hover:bg-white/10"
        >
          Cancel
        </button>
      </div>
    </>
  );
}
