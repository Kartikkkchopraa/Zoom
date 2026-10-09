"use client";

import { toast } from "@/lib/toast";

import { currentConnection } from "./connection";
import { useMedia } from "./media";
import { useRoom, type HostSettings, type Participant, type Role } from "./room";

const SETTING_KEYS: Record<keyof HostSettings, string> = {
  locked: "locked",
  waitingRoom: "waiting_room",
  allowShare: "allow_share",
  allowChat: "allow_chat",
  allowRename: "allow_rename",
  allowUnmute: "allow_unmute",
};

/**
 * Everything the UI can do in a meeting. Components call these instead of
 * touching stores or the socket directly.
 *
 * Mic/camera/share only change local media: the connection observes the
 * media store and tells peers. Chat, reactions and renames go to the server,
 * which echoes them back to everyone (including us) so ordering is shared.
 */

const send = (message: Record<string, unknown>) => currentConnection()?.send(message);
const isAttendee = () => useRoom.getState().self?.role === "attendee";

export const roomActions = {
  toggleMic() {
    const media = useMedia.getState();
    if (!media.audioConnected) {
      return void media.connectAudio().then(() => {
        const { error, audioConnected } = useMedia.getState();
        if (!audioConnected) toast(error ?? "Couldn't connect your microphone", "error");
      });
    }
    if (media.micMuted && isAttendee() && !useRoom.getState().host.allowUnmute) {
      return toast("The host has disabled unmuting");
    }
    media.setMicMuted(!media.micMuted);
  },

  toggleCamera() {
    const media = useMedia.getState();
    return media.videoTrack ? media.stopCamera() : media.startCamera();
  },

  async toggleShare() {
    const media = useMedia.getState();
    if (media.screenTrack) return media.stopShare();
    if (isAttendee() && !useRoom.getState().host.allowShare) {
      return toast("The host has disabled screen sharing");
    }
    const sharer = Object.values(useRoom.getState().remote).find((p) => p.sharing);
    if (sharer) return toast(`${sharer.name} is already sharing their screen`);
    await media.startShare();
  },

  sendChat(body: string, recipient: Participant | null) {
    send({ type: "chat", body, to: recipient?.id ?? null });
  },

  toggleHand() {
    const { self, setSelf } = useRoom.getState();
    if (!self) return;
    setSelf({ handRaised: !self.handRaised });
    send({ type: "state", patch: { hand_raised: !self.handRaised } });
  },

  react(emoji: string) {
    send({ type: "reaction", emoji });
  },

  rename(name: string) {
    send({ type: "rename", name });
  },

  /** Unmute after the host asked us to (allowed even when self-unmute is off). */
  acceptUnmuteRequest() {
    useRoom.getState().setUnmuteRequest(null);
    const media = useMedia.getState();
    if (media.audioConnected) media.setMicMuted(false);
    else void media.connectAudio().then(() => useMedia.getState().setMicMuted(false));
  },

  // ---- host / co-host controls (the server checks the caller's role) ---- //

  setHostSetting(patch: Partial<HostSettings>) {
    const wire = Object.fromEntries(
      Object.entries(patch).map(([k, v]) => [SETTING_KEYS[k as keyof HostSettings], v]),
    );
    send({ type: "settings", patch: wire });
  },

  muteAll(allowUnmute: boolean) {
    send({ type: "mute_all", allow_unmute: allowUnmute });
  },

  mute(peerId: string) {
    send({ type: "mute", peer_id: peerId });
  },

  /** One participant, or (no id) everyone who is muted. */
  askToUnmute(peerId?: string) {
    send({ type: "ask_unmute", peer_id: peerId ?? null });
    toast(peerId ? "Asked to unmute" : "Asked everyone to unmute");
  },

  remove(peerId: string) {
    send({ type: "remove", peer_id: peerId });
  },

  setRole(peerId: string, role: Role) {
    send({ type: "set_role", peer_id: peerId, role });
  },

  admit(peerId?: string) {
    send({ type: "admit", peer_id: peerId ?? null });
  },

  deny(peerId: string) {
    send({ type: "deny", peer_id: peerId });
  },
};
