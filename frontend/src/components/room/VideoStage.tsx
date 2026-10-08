"use client";

import { useEffect } from "react";

import { fitGrid, useElementSize } from "@/lib/meeting/layout";
import type { Participant } from "@/lib/meeting/room";
import { useRoom } from "@/lib/meeting/room";
import { useSpeaking } from "@/lib/meeting/useAudioLevel";

import { VideoTile, VideoView } from "./VideoTile";

const FILMSTRIP_HEIGHT = 112;

/** Feeds a participant's voice activity into the room store (renders nothing). */
function SpeakingProbe({ participant }: { participant: Participant }) {
  const speaking = useSpeaking(participant.audioTrack, !participant.micMuted);
  const setSpeaking = useRoom((s) => s.setSpeaking);
  useEffect(() => setSpeaking(participant.id, speaking), [participant.id, speaking, setSpeaking]);
  return null;
}

/** The video area: Speaker view, Gallery view, or a screen share. */
export function VideoStage({ participants }: { participants: Participant[] }) {
  const view = useRoom((s) => s.view);
  const pinnedId = useRoom((s) => s.pinnedId);
  const speaking = useRoom((s) => s.speaking);
  const activeId = useRoom((s) => s.activeSpeakerId);
  const [ref, size] = useElementSize<HTMLDivElement>();

  const sharer = participants.find((p) => p.sharing && p.screenStream);
  const byId = (id: string | null) => participants.find((p) => p.id === id);
  const pinned = byId(pinnedId);
  // Zoom prefers showing someone else in Speaker view when you're the one talking.
  const others = participants.filter((p) => !p.isSelf);
  const main = pinned ?? (byId(activeId)?.isSelf ? undefined : byId(activeId)) ?? others[0] ?? participants[0];

  let content: React.ReactNode = null;
  if (size.width > 0) {
    if (sharer) {
      content = <ShareLayout sharer={sharer} participants={participants} speaking={speaking} size={size} />;
    } else if (participants.length === 1 || (view === "gallery" && !pinned)) {
      content = <GalleryLayout participants={participants} speaking={speaking} size={size} />;
    } else {
      content = <SpeakerLayout main={main} participants={participants} speaking={speaking} size={size} />;
    }
  }

  return (
    <div ref={ref} className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-room">
      {participants.map((p) => (
        <SpeakingProbe key={p.id} participant={p} />
      ))}
      {content}
    </div>
  );
}

type Size = { width: number; height: number };

function GalleryLayout({
  participants,
  speaking,
  size,
}: {
  participants: Participant[];
  speaking: Record<string, boolean>;
  size: Size;
}) {
  const single = participants.length === 1;
  // A lone tile fills the width edge-to-edge like Zoom; grids get a margin.
  const pad = single ? 0 : 8;
  const grid = fitGrid(size.width - pad * 2, size.height - pad * 2, participants.length);
  return (
    <div className="flex size-full items-center justify-center" style={{ padding: pad }}>
      <div
        className="grid justify-center gap-1.5"
        style={{ gridTemplateColumns: `repeat(${grid.cols}, ${grid.tileWidth}px)` }}
      >
        {participants.map((p) => (
          <VideoTile
            key={p.id}
            participant={p}
            speaking={!single && speaking[p.id]}
            width={grid.tileWidth}
            height={grid.tileHeight}
          />
        ))}
      </div>
    </div>
  );
}

function SpeakerLayout({
  main,
  participants,
  speaking,
  size,
}: {
  main: Participant;
  participants: Participant[];
  speaking: Record<string, boolean>;
  size: Size;
}) {
  const strip = participants.filter((p) => p.id !== main.id);
  const thumbW = (FILMSTRIP_HEIGHT - 8) * (16 / 9);
  const mainArea = { width: size.width, height: size.height - FILMSTRIP_HEIGHT };
  const fit = fitGrid(mainArea.width, mainArea.height, 1, 0);

  return (
    <div className="flex size-full flex-col">
      <div className="flex shrink-0 justify-center gap-1 overflow-x-auto py-1" style={{ height: FILMSTRIP_HEIGHT }}>
        {strip.map((p) => (
          <VideoTile
            key={p.id}
            participant={p}
            speaking={speaking[p.id]}
            width={thumbW}
            height={FILMSTRIP_HEIGHT - 8}
            compact
          />
        ))}
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <VideoTile participant={main} width={fit.tileWidth} height={fit.tileHeight} />
      </div>
    </div>
  );
}

function ShareLayout({
  sharer,
  participants,
  speaking,
  size,
}: {
  sharer: Participant;
  participants: Participant[];
  speaking: Record<string, boolean>;
  size: Size;
}) {
  const thumbW = (FILMSTRIP_HEIGHT - 8) * (16 / 9);
  return (
    <div className="flex size-full flex-col">
      <div className="flex shrink-0 justify-center gap-1 overflow-x-auto py-1" style={{ height: FILMSTRIP_HEIGHT }}>
        {participants.map((p) => (
          <VideoTile
            key={p.id}
            participant={p}
            speaking={speaking[p.id]}
            width={thumbW}
            height={FILMSTRIP_HEIGHT - 8}
            compact
          />
        ))}
      </div>
      <div className="relative min-h-0 flex-1" style={{ maxHeight: size.height - FILMSTRIP_HEIGHT }}>
        <VideoView stream={sharer.screenStream!} fit="contain" />
        <span className="absolute top-2 left-1/2 -translate-x-1/2 rounded bg-black/70 px-2 py-0.5 text-xs text-white">
          {sharer.isSelf ? "Your screen" : `${sharer.name}'s screen`}
        </span>
      </div>
    </div>
  );
}
