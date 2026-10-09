"use client";

import { Volume2 } from "lucide-react";
import { useEffect, useRef } from "react";

import { playOrFlag, unlockAudio, useAudioUnlock } from "@/lib/meeting/audioUnlock";
import { useMedia } from "@/lib/meeting/media";
import type { Participant } from "@/lib/meeting/room";

/** Hidden <audio> elements that play each remote participant's voice. */
export function RemoteAudio({ participants }: { participants: Participant[] }) {
  const blocked = useAudioUnlock((s) => s.blocked);

  // While blocked, the next tap anywhere (e.g. on Unmute) also unlocks sound.
  useEffect(() => {
    if (!blocked) return;
    const retry = () => void unlockAudio();
    document.addEventListener("pointerdown", retry, { once: true });
    return () => document.removeEventListener("pointerdown", retry);
  }, [blocked]);

  useEffect(() => () => useAudioUnlock.getState().setBlocked(false), []);

  return (
    <>
      {participants
        .filter((p) => !p.isSelf && p.audioTrack)
        .map((p) => (
          <AudioSink key={p.id} track={p.audioTrack!} />
        ))}
      {blocked && (
        <button
          type="button"
          onClick={() => void unlockAudio()}
          className="absolute top-16 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-zoom-blue px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-zoom-blue-hover"
        >
          <Volume2 className="size-4" /> Tap to turn on sound
        </button>
      )}
    </>
  );
}

function AudioSink({ track }: { track: MediaStreamTrack }) {
  const ref = useRef<HTMLAudioElement>(null);
  const speakerId = useMedia((s) => s.speakerId);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = new MediaStream([track]);
    playOrFlag(el); // autoPlay alone fails silently when the browser blocks it
  }, [track]);

  useEffect(() => {
    // Output device selection (Chrome/Edge); other browsers use the default.
    const el = ref.current as (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }) | null;
    if (el?.setSinkId && speakerId) void el.setSinkId(speakerId).catch(() => undefined);
  }, [speakerId]);

  return <audio ref={ref} autoPlay playsInline />;
}
