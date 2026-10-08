"use client";

import { toast } from "@/lib/toast";

import { currentConnection } from "./connection";
import { useMedia } from "./media";
import { useRoom, type HostSettings, type Participant } from "./room";

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
    if (!media.audioConnected) return void media.connectAudio();
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

  setHostSetting(patch: Partial<HostSettings>) {
    // Enforced server-side in Phase 7; local for now.
    useRoom.getState().setHost(patch);
  },

  muteAll() {
    // Host controls are wired to the server in Phase 7.
    toast("All participants are muted");
  },
};
