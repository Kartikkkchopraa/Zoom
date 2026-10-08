"use client";

import { useMemo } from "react";

import { useMedia } from "./media";
import { useRoom, type Participant } from "./room";

/**
 * The self participant is derived from local media state instead of being
 * stored, so mic/camera state can never drift out of sync with the tracks.
 */
export function useSelfParticipant(): Participant | null {
  const self = useRoom((s) => s.self);
  const audioConnected = useMedia((s) => s.audioConnected);
  const micMuted = useMedia((s) => s.micMuted);
  const videoTrack = useMedia((s) => s.videoTrack);
  const screenTrack = useMedia((s) => s.screenTrack);
  const audioTrack = useMedia((s) => s.audioTrack);

  const stream = useMemo(() => (videoTrack ? new MediaStream([videoTrack]) : undefined), [videoTrack]);
  const screenStream = useMemo(
    () => (screenTrack ? new MediaStream([screenTrack]) : undefined),
    [screenTrack],
  );

  return useMemo(
    () =>
      self && {
        ...self,
        isSelf: true,
        audioConnected,
        micMuted: !audioConnected || micMuted,
        videoOn: !!videoTrack,
        sharing: !!screenTrack,
        stream,
        screenStream,
        // Only analyse our own mic while unmuted, so a muted mic never "speaks".
        audioTrack: audioConnected && !micMuted ? audioTrack : null,
      },
    [self, audioConnected, micMuted, videoTrack, screenTrack, stream, screenStream, audioTrack],
  );
}

/** Everyone in the room, self first, then by name (Zoom's participant order). */
export function useParticipants(): Participant[] {
  const self = useSelfParticipant();
  const remote = useRoom((s) => s.remote);
  return useMemo(() => {
    const others = Object.values(remote).sort((a, b) => a.name.localeCompare(b.name));
    return self ? [self, ...others] : others;
  }, [self, remote]);
}

export function roleLabel(p: Participant): string {
  const tags = [p.role === "host" ? "Host" : p.role === "co_host" ? "Co-host" : null, p.isSelf ? "me" : null];
  const shown = tags.filter(Boolean);
  return shown.length ? `(${shown.join(", ")})` : "";
}
