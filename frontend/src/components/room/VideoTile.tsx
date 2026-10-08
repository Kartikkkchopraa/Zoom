"use client";

import clsx from "clsx";
import { Hand, MicOff } from "lucide-react";
import { useEffect, useRef } from "react";

import type { Participant } from "@/lib/meeting/room";
import { useRoom } from "@/lib/meeting/room";

/** Attaches a MediaStream to a <video> element. */
export function VideoView({
  stream,
  mirrored,
  fit = "cover",
  className,
}: {
  stream: MediaStream;
  mirrored?: boolean;
  fit?: "cover" | "contain";
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted // audio is played separately so tiles never echo
      className={clsx(
        "size-full",
        fit === "cover" ? "object-cover" : "object-contain",
        mirrored && "-scale-x-100",
        className,
      )}
    />
  );
}

interface VideoTileProps {
  participant: Participant;
  speaking?: boolean;
  width: number;
  height: number;
  /** Smaller avatar + name for filmstrip thumbnails. */
  compact?: boolean;
}

/** One participant: video (or the initial avatar) with the Zoom name tag. */
export function VideoTile({ participant: p, speaking, width, height, compact }: VideoTileProps) {
  // Select the stable array, filter in render (a filtering selector would
  // return a new array every time and re-render forever).
  const allReactions = useRoom((s) => s.reactions);
  const reactions = allReactions.filter((r) => r.participantId === p.id);
  const avatarSize = Math.round(Math.min(96, height * (compact ? 0.45 : 0.22)));

  return (
    <div
      className={clsx(
        "relative overflow-hidden bg-room-tile",
        speaking && "outline-[3px] -outline-offset-[3px] outline-[#23d959]",
      )}
      style={{ width, height }}
    >
      {p.videoOn && p.stream ? (
        <VideoView stream={p.stream} mirrored={p.isSelf} />
      ) : (
        <div className="flex size-full items-center justify-center">
          <span
            className="flex items-center justify-center bg-avatar text-white select-none"
            style={{ width: avatarSize, height: avatarSize, fontSize: avatarSize * 0.5 }}
          >
            {p.name.trim()[0]?.toUpperCase() ?? "?"}
          </span>
        </div>
      )}

      {(p.handRaised || reactions.length > 0) && (
        <div className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-1 text-xl leading-none">
          {p.handRaised && <Hand className="size-5 fill-[#f6c343] text-[#d9a521]" />}
          {reactions.slice(-1).map((r) => (
            <span key={r.id} className="animate-[pop_0.3s_ease-out]">
              {r.emoji}
            </span>
          ))}
        </div>
      )}

      <div
        className={clsx(
          "absolute bottom-1 left-1 flex max-w-[calc(100%-8px)] items-center gap-1 rounded bg-black/75 px-1.5 py-0.5 text-white",
          compact ? "text-[11px]" : "text-[13px]",
        )}
      >
        {p.micMuted && <MicOff className="size-3.5 shrink-0 text-[#ff4d4f]" strokeWidth={2.2} />}
        <span className="truncate">{p.name}</span>
      </div>
    </div>
  );
}
