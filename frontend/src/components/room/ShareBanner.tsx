"use client";

import { useMedia } from "@/lib/meeting/media";

/** Zoom's green "You are screen sharing · Stop Share" pill while sharing. */
export function ShareBanner() {
  const sharing = useMedia((s) => !!s.screenTrack);
  const stopShare = useMedia((s) => s.stopShare);
  if (!sharing) return null;
  return (
    <div className="flex items-center gap-3 rounded-lg bg-[#1f8a3d] py-1 pr-1 pl-3 text-sm whitespace-nowrap text-white shadow-lg">
      <span className="size-2 rounded-full bg-white" />
      You are screen sharing
      <button type="button" onClick={stopShare} className="rounded-md bg-zoom-end px-3 py-1 text-xs font-semibold hover:bg-[#a72e23]">
        Stop Share
      </button>
    </div>
  );
}
