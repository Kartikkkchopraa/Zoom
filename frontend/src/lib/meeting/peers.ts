/**
 * WebRTC mesh: one RTCPeerConnection per remote participant.
 *
 * Negotiation rules (no glare possible):
 * - The newcomer is the *initiator* towards everyone already in the room and
 *   is the only side that ever sends offers (including ICE restarts).
 * - The initiator creates three transceivers in a fixed order:
 *   [0] audio, [1] camera, [2] screen share. The answerer gets the same order
 *   from the offer, so slot index identifies what a remote track is.
 * - Turning the camera/mic/screen on or off later uses sender.replaceTrack(),
 *   which needs no renegotiation; peers learn on/off from signaled state.
 */

export interface LocalTracks {
  audio: MediaStreamTrack | null;
  camera: MediaStreamTrack | null;
  screen: MediaStreamTrack | null;
}

export interface RemoteMedia {
  audioTrack?: MediaStreamTrack;
  stream?: MediaStream; // camera
  screenStream?: MediaStream;
}

export type SignalData = { description: RTCSessionDescriptionInit } | { candidate: RTCIceCandidateInit };

const SLOTS = ["audio", "camera", "screen"] as const;
type Slot = (typeof SLOTS)[number];

interface PeerEntry {
  pc: RTCPeerConnection;
  initiator: boolean;
  /** ICE candidates that arrived before the remote description. */
  pendingCandidates: RTCIceCandidateInit[];
  media: RemoteMedia;
}

export class PeerManager {
  private peers = new Map<string, PeerEntry>();
  private local: LocalTracks = { audio: null, camera: null, screen: null };

  constructor(
    private iceServers: RTCIceServer[],
    private sendSignal: (to: string, data: SignalData) => void,
    private onRemoteMedia: (peerId: string, media: RemoteMedia) => void,
  ) {}

  /** Call a peer that was already in the room when we joined. */
  connect(peerId: string): void {
    if (this.peers.has(peerId)) return;
    const entry = this.create(peerId, true);
    for (const slot of SLOTS) {
      entry.pc.addTransceiver(slot === "audio" ? "audio" : "video", { direction: "sendrecv" });
    }
    void this.attachLocalTracks(entry);
    // Adding transceivers fires negotiationneeded -> offer (see create()).
  }

  async handleSignal(from: string, data: SignalData): Promise<void> {
    if ("description" in data) {
      const description = data.description;
      // An offer from someone new: they joined after us, so we answer.
      const entry = this.peers.get(from) ?? this.create(from, false);
      const { pc } = entry;
      await pc.setRemoteDescription(description);
      if (description.type === "offer") {
        if (!entry.initiator) {
          for (const t of pc.getTransceivers()) t.direction = "sendrecv";
          await this.attachLocalTracks(entry);
        }
        await pc.setLocalDescription();
        this.sendSignal(from, { description: pc.localDescription!.toJSON() });
      }
      for (const candidate of entry.pendingCandidates.splice(0)) {
        await pc.addIceCandidate(candidate).catch(() => undefined);
      }
    } else {
      const entry = this.peers.get(from);
      if (!entry) return;
      if (entry.pc.remoteDescription) {
        await entry.pc.addIceCandidate(data.candidate).catch(() => undefined);
      } else {
        entry.pendingCandidates.push(data.candidate);
      }
    }
  }

  /** Swap our outgoing tracks on every connection (no renegotiation). */
  setLocalTracks(tracks: LocalTracks): void {
    this.local = tracks;
    for (const entry of this.peers.values()) void this.attachLocalTracks(entry);
  }

  remove(peerId: string): void {
    this.peers.get(peerId)?.pc.close();
    this.peers.delete(peerId);
  }

  closeAll(): void {
    for (const entry of this.peers.values()) entry.pc.close();
    this.peers.clear();
  }

  private create(peerId: string, initiator: boolean): PeerEntry {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const entry: PeerEntry = { pc, initiator, pendingCandidates: [], media: {} };
    this.peers.set(peerId, entry);

    pc.onicecandidate = (e) => {
      if (e.candidate) this.sendSignal(peerId, { candidate: e.candidate.toJSON() });
    };

    if (initiator) {
      pc.onnegotiationneeded = async () => {
        try {
          await pc.setLocalDescription();
          this.sendSignal(peerId, { description: pc.localDescription!.toJSON() });
        } catch (err) {
          console.warn("negotiation failed", err);
        }
      };
      // Network change or NAT timeout: the initiator renegotiates with fresh ICE.
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed") pc.restartIce();
      };
    }

    pc.ontrack = (e) => {
      const slot = SLOTS[pc.getTransceivers().indexOf(e.transceiver)];
      if (!slot) return;
      entry.media = { ...entry.media, ...mediaFor(slot, e.track) };
      this.onRemoteMedia(peerId, entry.media);
    };

    return entry;
  }

  private async attachLocalTracks(entry: PeerEntry): Promise<void> {
    const transceivers = entry.pc.getTransceivers();
    await Promise.all(
      SLOTS.map(async (slot, i) => {
        const sender = transceivers[i]?.sender;
        const track = this.local[slot];
        if (sender && sender.track !== track) await sender.replaceTrack(track).catch(() => undefined);
      }),
    );
  }
}

function mediaFor(slot: Slot, track: MediaStreamTrack): RemoteMedia {
  if (slot === "audio") return { audioTrack: track };
  if (slot === "camera") return { stream: new MediaStream([track]) };
  return { screenStream: new MediaStream([track]) };
}
