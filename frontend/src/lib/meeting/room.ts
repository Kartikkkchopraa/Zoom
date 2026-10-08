"use client";

import { create } from "zustand";

import type { MeetingRoom } from "@/lib/types";

/**
 * Meeting room state that isn't local media: who is here, chat, panels,
 * view mode and host settings. In Phase 4 this is local only; Phase 5 feeds
 * remote participants and chat into it from the signaling WebSocket.
 */

export type Role = "host" | "co_host" | "attendee";

export interface Participant {
  id: string;
  name: string;
  role: Role;
  isSelf: boolean;
  audioConnected: boolean;
  micMuted: boolean;
  videoOn: boolean;
  sharing: boolean;
  handRaised: boolean;
  /** Camera video (and, for remote participants, their audio). */
  stream?: MediaStream;
  /** Screen share video while `sharing`. */
  screenStream?: MediaStream;
  /** Audio track used for speaking detection. */
  audioTrack?: MediaStreamTrack | null;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  /** null = everyone ("Meeting Group Chat"). */
  recipientId: string | null;
  recipientName?: string;
  body: string;
  sentAt: number;
}

export interface Reaction {
  id: string;
  participantId: string;
  emoji: string;
}

export type Panel = "participants" | "chat" | null;
export type ViewMode = "speaker" | "gallery";

/** Host tools toggles ("Allow all participants to…"). */
export interface HostSettings {
  locked: boolean;
  waitingRoom: boolean;
  allowShare: boolean;
  allowChat: boolean;
  allowRename: boolean;
  allowUnmute: boolean;
}

interface SelfInfo {
  id: string;
  name: string;
  role: Role;
  handRaised: boolean;
}

interface RoomState {
  meeting: MeetingRoom | null;
  self: SelfInfo | null;
  remote: Record<string, Participant>;
  messages: ChatMessage[];
  unreadChat: number;
  reactions: Reaction[];
  panel: Panel;
  view: ViewMode;
  pinnedId: string | null;
  host: HostSettings;

  init: (meeting: MeetingRoom, self: SelfInfo) => void;
  reset: () => void;
  setSelf: (patch: Partial<SelfInfo>) => void;
  setPanel: (panel: Panel) => void;
  togglePanel: (panel: Exclude<Panel, null>) => void;
  setView: (view: ViewMode) => void;
  setPinned: (id: string | null) => void;
  addMessage: (message: ChatMessage) => void;
  addReaction: (participantId: string, emoji: string) => void;
  setHost: (patch: Partial<HostSettings>) => void;
}

const REACTION_MS = 10_000; // Zoom shows a reaction for ~10 seconds

const initial = {
  meeting: null,
  self: null,
  remote: {},
  messages: [],
  unreadChat: 0,
  reactions: [],
  panel: null as Panel,
  view: "speaker" as ViewMode,
  pinnedId: null,
  host: {
    locked: false,
    waitingRoom: false,
    allowShare: true,
    allowChat: true,
    allowRename: true,
    allowUnmute: true,
  },
};

export const useRoom = create<RoomState>((set, get) => ({
  ...initial,

  init: (meeting, self) =>
    set({ ...initial, meeting, self, host: { ...initial.host, waitingRoom: meeting.waiting_room } }),
  reset: () => set(initial),
  setSelf: (patch) => set((s) => ({ self: s.self && { ...s.self, ...patch } })),

  setPanel: (panel) => set({ panel, ...(panel === "chat" ? { unreadChat: 0 } : {}) }),
  togglePanel: (panel) => get().setPanel(get().panel === panel ? null : panel),
  setView: (view) => set({ view }),
  setPinned: (pinnedId) => set({ pinnedId }),

  addMessage: (message) =>
    set((s) => ({
      messages: [...s.messages, message],
      unreadChat: s.panel === "chat" || message.senderId === s.self?.id ? 0 : s.unreadChat + 1,
    })),

  addReaction: (participantId, emoji) => {
    const id = crypto.randomUUID();
    set((s) => ({ reactions: [...s.reactions, { id, participantId, emoji }] }));
    setTimeout(() => set((s) => ({ reactions: s.reactions.filter((r) => r.id !== id) })), REACTION_MS);
  },

  setHost: (patch) => set((s) => ({ host: { ...s.host, ...patch } })),
}));
