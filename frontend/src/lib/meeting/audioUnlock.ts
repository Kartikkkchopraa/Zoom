"use client";

import { create } from "zustand";

/**
 * Mobile browsers (and desktop ones with strict autoplay settings) refuse to
 * start audio until the user taps. Remote video still plays because it's
 * muted, so the call looks fine but is silent. Audio elements report
 * refusals here; the room shows "Tap to turn on sound", and any tap retries.
 */
interface AudioUnlockState {
  blocked: boolean;
  setBlocked: (blocked: boolean) => void;
}

export const useAudioUnlock = create<AudioUnlockState>((set) => ({
  blocked: false,
  setBlocked: (blocked) => set({ blocked }),
}));

/** Must run inside a user gesture (click/tap handler). */
export async function unlockAudio(): Promise<void> {
  const elements = [...document.querySelectorAll("audio")];
  const results = await Promise.allSettled(elements.map((el) => el.play()));
  useAudioUnlock.getState().setBlocked(results.some((r) => r.status === "rejected"));
}

/** Play an element; record an autoplay refusal instead of failing silently. */
export function playOrFlag(el: HTMLMediaElement): void {
  el.play().catch((err: unknown) => {
    if (err instanceof DOMException && err.name === "NotAllowedError") {
      useAudioUnlock.getState().setBlocked(true);
    }
  });
}
