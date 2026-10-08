"use client";

import { useEffect, useRef } from "react";

import { useMedia } from "@/lib/meeting/media";
import type { Participant } from "@/lib/meeting/room";

/** Hidden <audio> elements that play each remote participant's voice. */
export function RemoteAudio({ participants }: { participants: Participant[] }) {
  return (
    <>
      {participants
        .filter((p) => !p.isSelf && p.audioTrack)
        .map((p) => (
          <AudioSink key={p.id} track={p.audioTrack!} />
        ))}
    </>
  );
}

function AudioSink({ track }: { track: MediaStreamTrack }) {
  const ref = useRef<HTMLAudioElement>(null);
  const speakerId = useMedia((s) => s.speakerId);

  useEffect(() => {
    if (ref.current) ref.current.srcObject = new MediaStream([track]);
  }, [track]);

  useEffect(() => {
    // Output device selection (Chrome/Edge); other browsers use the default.
    const el = ref.current as (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }) | null;
    if (el?.setSinkId && speakerId) void el.setSinkId(speakerId).catch(() => undefined);
  }, [speakerId]);

  return <audio ref={ref} autoPlay />;
}
