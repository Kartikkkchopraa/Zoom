"use client";

import { toast } from "@/lib/toast";

import { useMedia } from "./media";
import { useRoom, type HostSettings, type Participant } from "./room";

/**
 * Everything the UI can do in a meeting. Components call these instead of
 * touching stores directly, so Phase 5 can route them over the signaling
 * WebSocket without changing any component.
 */
export const roomActions = {
  toggleMic() {
    const media = useMedia.getState();
    if (!media.audioConnected) return void media.connectAudio();
    if (media.micMuted && !useRoom.getState().host.allowUnmute && useRoom.getState().self?.role === "attendee") {
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
    const room = useRoom.getState();
    if (!room.host.allowShare && room.self?.role === "attendee") {
      return toast("The host has disabled screen sharing");
    }
    await media.startShare();
  },

  sendChat(body: string, recipient: Participant | null) {
    const { self, addMessage } = useRoom.getState();
    if (!self) return;
    addMessage({
      id: crypto.randomUUID(),
      senderId: self.id,
      senderName: self.name,
      recipientId: recipient?.id ?? null,
      recipientName: recipient?.name,
      body,
      sentAt: Date.now(),
    });
  },

  toggleHand() {
    const { self, setSelf } = useRoom.getState();
    if (self) setSelf({ handRaised: !self.handRaised });
  },

  react(emoji: string) {
    const { self, addReaction } = useRoom.getState();
    if (self) addReaction(self.id, emoji);
  },

  rename(name: string) {
    useRoom.getState().setSelf({ name });
  },

  setHostSetting(patch: Partial<HostSettings>) {
    useRoom.getState().setHost(patch);
  },

  muteAll() {
    // Remote participants arrive in Phase 5; host controls are enforced in Phase 7.
    toast("All participants are muted");
  },
};
