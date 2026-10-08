import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * What the user chose before entering a meeting room. Kept per meeting code in
 * sessionStorage so a page refresh re-joins with the same name and credentials.
 */
export interface JoinSession {
  displayName: string;
  /** What was validated by join-check: the meeting ID or the full invite link. */
  credential: string;
  passcode?: string;
  joinAudio: boolean;
  videoOn: boolean;
  /** Entered via Start / New meeting (host) rather than Join. */
  asHost: boolean;
}

interface JoinSessionState {
  sessions: Record<string, JoinSession>;
  save: (code: string, session: JoinSession) => void;
  clear: (code: string) => void;
}

export const useJoinSessions = create<JoinSessionState>()(
  persist(
    (set) => ({
      sessions: {},
      save: (code, session) => set((s) => ({ sessions: { ...s.sessions, [code]: session } })),
      clear: (code) =>
        set((s) => {
          const sessions = { ...s.sessions };
          delete sessions[code];
          return { sessions };
        }),
    }),
    { name: "zoom-join-sessions", storage: createJSONStorage(() => sessionStorage) },
  ),
);

/** Name prefill for join forms ("Remember my name for future meetings"). */
interface RememberedName {
  name: string | null;
  setName: (name: string | null) => void;
}

export const useRememberedName = create<RememberedName>()(
  persist((set) => ({ name: null, setName: (name) => set({ name }) }), { name: "zoom-remembered-name" }),
);
