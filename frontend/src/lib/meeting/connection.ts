"use client";

import { api } from "@/lib/api";
import { toast } from "@/lib/toast";

import { clientId } from "./clientId";
import { useMedia } from "./media";
import { PeerManager, type SignalData } from "./peers";
import { useRoom, type HostSettings, type Participant, type RemoteInfo, type Role } from "./room";

/** Wire format of a participant as sent by the server (app/ws/room.py Peer.public). */
interface ServerPeer {
  id: string;
  participant_id: number | null;
  name: string;
  role: Role;
  audio_connected: boolean;
  mic_muted: boolean;
  video_on: boolean;
  sharing: boolean;
  hand_raised: boolean;
}

type ServerPatch = Partial<Omit<ServerPeer, "id" | "participant_id">>;

type ServerMessage =
  | { type: "welcome"; self: ServerPeer; peers: ServerPeer[]; settings: Record<string, boolean> }
  | { type: "waiting_for_host" }
  | { type: "waiting_room" }
  | { type: "waiting_list"; peers: { id: string; name: string }[] }
  | { type: "settings_updated"; settings: Record<string, boolean> }
  | { type: "force_mute"; by: string | null }
  | { type: "unmute_request"; by: string }
  | { type: "removed"; message: string }
  | { type: "peer_joined"; peer: ServerPeer }
  | { type: "peer_left"; peer_id: string }
  | { type: "peer_updated"; peer_id: string; patch: ServerPatch }
  | { type: "signal"; from: string; data: SignalData }
  | { type: "chat"; message: ServerChat }
  | { type: "reaction"; peer_id: string; emoji: string }
  | { type: "meeting_ended"; reason: string }
  | { type: "error"; code: string; message: string };

interface ServerChat {
  id: number;
  sender_id: string;
  sender_name: string;
  recipient_id: string | null;
  recipient_name: string | null;
  body: string;
  sent_at: string;
}

function toRemote(p: ServerPeer): RemoteInfo {
  return {
    id: p.id,
    name: p.name,
    role: p.role,
    audioConnected: p.audio_connected,
    micMuted: p.mic_muted,
    videoOn: p.video_on,
    sharing: p.sharing,
    handRaised: p.hand_raised,
  };
}

function toPatch(p: ServerPatch): Partial<Participant> {
  const out: Partial<Participant> = {};
  if (p.name !== undefined) out.name = p.name;
  if (p.role !== undefined) out.role = p.role;
  if (p.audio_connected !== undefined) out.audioConnected = p.audio_connected;
  if (p.mic_muted !== undefined) out.micMuted = p.mic_muted;
  if (p.video_on !== undefined) out.videoOn = p.video_on;
  if (p.sharing !== undefined) out.sharing = p.sharing;
  if (p.hand_raised !== undefined) out.handRaised = p.hand_raised;
  return out;
}

function toHostSettings(s: Record<string, boolean>): Partial<HostSettings> {
  return {
    locked: s.locked,
    waitingRoom: s.waiting_room,
    allowShare: s.allow_share,
    allowChat: s.allow_chat,
    allowRename: s.allow_rename,
    allowUnmute: s.allow_unmute,
  };
}

/** What our own media looks like to others. */
function mediaState() {
  const m = useMedia.getState();
  return {
    audio_connected: m.audioConnected,
    mic_muted: !m.audioConnected || m.micMuted,
    video_on: !!m.videoTrack,
    sharing: !!m.screenTrack,
  };
}

function wsBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  // Local dev: the backend runs on :8000 next to the Next.js dev server.
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.hostname}:8000`;
}

/**
 * One meeting session: the signaling WebSocket plus the WebRTC mesh.
 * Writes everything it learns into the room store; roomActions send through it.
 */
export class MeetingConnection {
  private ws: WebSocket | null = null;
  private peers: PeerManager | null = null;
  private unsubscribeMedia: (() => void) | null = null;
  private closed = false;
  /** Settles a pending endForAll(): true when the server confirms, false if refused. */
  private onEnded: ((ended: boolean) => void) | null = null;

  constructor(
    private code: string,
    private join: { token: string; name: string; asHost: boolean },
  ) {}

  async start(): Promise<void> {
    let iceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
    try {
      iceServers = (await api.rtcConfig()).ice_servers;
    } catch {
      /* fall back to public STUN */
    }
    if (this.closed) return;

    this.peers = new PeerManager(
      iceServers,
      (to, data) => this.send({ type: "signal", to, data }),
      (peerId, media) => useRoom.getState().patchRemote(peerId, media),
    );
    this.syncLocalTracks();

    // Push our mic/camera/share changes to peers and the server.
    this.unsubscribeMedia = useMedia.subscribe((now, prev) => {
      if (now.audioTrack !== prev.audioTrack || now.videoTrack !== prev.videoTrack || now.screenTrack !== prev.screenTrack) {
        this.syncLocalTracks();
      }
      if (
        now.audioConnected !== prev.audioConnected ||
        now.micMuted !== prev.micMuted ||
        !!now.videoTrack !== !!prev.videoTrack ||
        !!now.screenTrack !== !!prev.screenTrack
      ) {
        this.send({ type: "state", patch: mediaState() });
      }
    });

    const ws = new WebSocket(`${wsBaseUrl()}/ws/meetings/${this.code}`);
    this.ws = ws;
    ws.onopen = () =>
      this.send({
        type: "join",
        token: this.join.token,
        name: this.join.name,
        as_host: this.join.asHost,
        state: { ...mediaState(), hand_raised: false },
        client_id: clientId(),
      });
    ws.onmessage = (e) => this.handle(JSON.parse(e.data) as ServerMessage);
    ws.onclose = () => {
      if (this.closed) return;
      const { status, setStatus } = useRoom.getState();
      if (status !== "ended" && status !== "error") {
        // Unexpected drop (network blip, server restart): the room retries.
        setStatus("error", "You have been disconnected from the meeting.", status === "joined");
      }
      this.teardown();
    };
  }

  send(message: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(message));
  }

  /**
   * End Meeting for All over this connection (the host role comes from the
   * live room, not the account cookie). Resolves false if the server doesn't
   * confirm in time, so the caller can fall back to the REST endpoint.
   */
  endForAll(timeoutMs = 4000): Promise<boolean> {
    if (this.ws?.readyState !== WebSocket.OPEN) return Promise.resolve(false);
    return new Promise((resolve) => {
      const settle = (ended: boolean) => {
        clearTimeout(timer);
        this.onEnded = null;
        resolve(ended);
      };
      const timer = setTimeout(() => settle(false), timeoutMs);
      this.onEnded = settle;
      this.send({ type: "end" });
    });
  }

  /** Leave on purpose (button, navigation): tell the server, then close. */
  leave(): void {
    if (this.closed) return;
    this.send({ type: "leave" });
    this.closed = true;
    this.ws?.close();
    this.teardown();
  }

  private teardown(): void {
    this.closed = true;
    this.unsubscribeMedia?.();
    this.unsubscribeMedia = null;
    this.peers?.closeAll();
  }

  private syncLocalTracks(): void {
    const m = useMedia.getState();
    this.peers?.setLocalTracks({ audio: m.audioTrack, camera: m.videoTrack, screen: m.screenTrack });
  }

  private handle(msg: ServerMessage): void {
    const room = useRoom.getState();
    switch (msg.type) {
      case "welcome":
        room.setSelf({ id: msg.self.id, participantId: msg.self.participant_id, role: msg.self.role, name: msg.self.name });
        room.setRemotes(msg.peers.map(toRemote));
        room.setHost(toHostSettings(msg.settings));
        room.setStatus("joined");
        // We're the newcomer: we call everyone who is already here.
        for (const peer of msg.peers) this.peers?.connect(peer.id);
        break;
      case "waiting_for_host":
        room.setStatus("waiting_host");
        break;
      case "waiting_room":
        room.setStatus("waiting_room");
        break;
      case "waiting_list": {
        const newcomer = msg.peers.find((p) => !room.waitingList.some((w) => w.id === p.id));
        if (newcomer) toast(`${newcomer.name} has entered the waiting room`);
        room.setWaitingList(msg.peers);
        break;
      }
      case "settings_updated":
        room.setHost(toHostSettings(msg.settings));
        break;
      case "force_mute":
        useMedia.getState().setMicMuted(true);
        room.setUnmuteRequest(null);
        if (msg.by) toast(`You have been muted by ${msg.by}`);
        break;
      case "unmute_request":
        room.setUnmuteRequest(msg.by);
        break;
      case "removed":
        room.setStatus("ended", msg.message);
        this.teardown();
        break;
      case "peer_joined":
        // They will call us; just show them.
        room.upsertRemote(toRemote(msg.peer));
        break;
      case "peer_left":
        this.peers?.remove(msg.peer_id);
        room.removeRemote(msg.peer_id);
        break;
      case "peer_updated":
        if (msg.peer_id === room.self?.id) {
          const patch = toPatch(msg.patch);
          if (patch.role && patch.role !== room.self?.role) {
            toast(patch.role === "host" ? "You are now the host" : patch.role === "co_host" ? "You are now a co-host" : "You are no longer a co-host");
          }
          room.setSelf({
            ...(patch.name !== undefined && { name: patch.name }),
            ...(patch.role !== undefined && { role: patch.role }),
            ...(patch.handRaised !== undefined && { handRaised: patch.handRaised }),
          });
        } else {
          const before = room.remote[msg.peer_id];
          room.patchRemote(msg.peer_id, toPatch(msg.patch));
          if (before && msg.patch.hand_raised && !before.handRaised) toast(`${before.name} raised their hand`);
        }
        break;
      case "signal":
        void this.peers?.handleSignal(msg.from, msg.data).catch((err) => console.warn("signal failed", err));
        break;
      case "chat":
        // Zoom-style preview when the chat panel is closed.
        if (room.panel !== "chat" && msg.message.sender_id !== room.self?.id) {
          toast(`${msg.message.sender_name}: ${msg.message.body.slice(0, 80)}`);
        }
        room.addMessage({
          id: String(msg.message.id),
          senderId: msg.message.sender_id,
          senderName: msg.message.sender_name,
          recipientId: msg.message.recipient_id,
          recipientName: msg.message.recipient_name ?? undefined,
          body: msg.message.body,
          sentAt: Date.parse(msg.message.sent_at),
        });
        break;
      case "reaction":
        room.addReaction(msg.peer_id, msg.emoji);
        break;
      case "meeting_ended":
        if (this.onEnded) {
          // We ended it ourselves: no "ended by host" screen, the caller navigates away.
          this.onEnded(true);
          this.teardown();
          break;
        }
        room.setStatus(
          "ended",
          msg.reason === "ended_by_host" ? "This meeting has been ended by host" : "This meeting has ended",
        );
        this.teardown();
        break;
      case "error":
        if (this.onEnded && msg.code === "not_allowed") {
          this.onEnded(false); // e.g. no longer host: let the caller fall back
          break;
        }
        if (msg.code === "share_in_use" || msg.code === "share_disabled") useMedia.getState().stopShare();
        if (room.status === "connecting") room.setStatus("error", msg.message);
        else toast(msg.message, "error");
        break;
    }
  }
}

// The live connection, so roomActions can send without prop drilling.
let current: MeetingConnection | null = null;
export const setCurrentConnection = (c: MeetingConnection | null) => {
  current = c;
};
export const currentConnection = () => current;
