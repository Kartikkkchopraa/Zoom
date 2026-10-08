"use client";

import { create } from "zustand";

import type { MeetingRoom } from "@/lib/types";

/**
 * Meeting room state that isn't local media: who is here, chat, panels,
 * view mode and host settings. Filled from the signaling WebSocket
 * (see connection.ts); components only read it and call roomActions.
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
  /** Camera video. */
  stream?: MediaStream;
  /** Screen share video while `sharing`. */
  screenStream?: MediaStream;
  /** Audio track: played for remote peers, analysed for speaking detection. */
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

export type ConnectionStatus =
  | "connecting"
  | "waiting_host" // joined before the host started the meeting
  | "joined"
  | "ended" // host ended it, or it ended after everyone left
  | "error";

/** Host tools toggles ("Allow all participants to…"). */
export interface HostSettings {
  locked: boolean;
  waitingRoom: boolean;
  allowShare: boolean;
  allowChat: boolean;
  allowRename: boolean;
  allowUnmute: boolean;
}

export interface SelfInfo {
  id: string;
  /** Database participant id, shown as "Participant ID" in meeting info. */
  participantId: number | null;
  name: string;
  role: Role;
  handRaised: boolean;
}

/** Remote participant fields that come from the server (no media). */
export type RemoteInfo = Omit<Participant, "isSelf" | "stream" | "screenStream" | "audioTrack">;

interface RoomState {
  meeting: MeetingRoom | null;
  status: ConnectionStatus;
  statusMessage: string | null;
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
  setStatus: (status: ConnectionStatus, message?: string | null) => void;
  setSelf: (patch: Partial<SelfInfo>) => void;
  setRemotes: (peers: RemoteInfo[]) => void;
  upsertRemote: (peer: RemoteInfo) => void;
  patchRemote: (id: string, patch: Partial<Participant>) => void;
  removeRemote: (id: string) => void;
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
  status: "connecting" as ConnectionStatus,
  statusMessage: null,
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
  setStatus: (status, statusMessage = null) => set({ status, statusMessage }),
  setSelf: (patch) => set((s) => ({ self: s.self && { ...s.self, ...patch } })),

  setRemotes: (peers) =>
    set({ remote: Object.fromEntries(peers.map((p) => [p.id, { ...p, isSelf: false }])) }),
  upsertRemote: (peer) =>
    set((s) => ({ remote: { ...s.remote, [peer.id]: { ...s.remote[peer.id], ...peer, isSelf: false } } })),
  patchRemote: (id, patch) =>
    set((s) => (s.remote[id] ? { remote: { ...s.remote, [id]: { ...s.remote[id], ...patch } } } : s)),
  removeRemote: (id) =>
    set((s) => {
      const remote = { ...s.remote };
      delete remote[id];
      return { remote, pinnedId: s.pinnedId === id ? null : s.pinnedId };
    }),

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
