import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Options from the "New meeting ▾" dropdown, remembered per browser like Zoom does. */
interface MeetingPrefs {
  startWithVideo: boolean;
  usePmi: boolean;
  set: (patch: Partial<Omit<MeetingPrefs, "set">>) => void;
}

export const useMeetingPrefs = create<MeetingPrefs>()(
  persist(
    (set) => ({
      startWithVideo: true,
      usePmi: false,
      set: (patch) => set(patch),
    }),
    { name: "zoom-meeting-prefs" },
  ),
);
