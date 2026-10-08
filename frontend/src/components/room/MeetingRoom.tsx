"use client";

import { useEffect, useRef, useState } from "react";

import { useMedia } from "@/lib/meeting/media";
import { useParticipants } from "@/lib/meeting/participants";
import { useRoom } from "@/lib/meeting/room";
import type { JoinSession } from "@/lib/session";
import type { MeetingRoom as MeetingRoomData } from "@/lib/types";

import { ChatPanel } from "./ChatPanel";
import { EndMeetingBar } from "./EndMeetingBar";
import { ParticipantsPanel } from "./ParticipantsPanel";
import { PermissionPrompt } from "./PermissionPrompt";
import { InviteDialog, SettingsDialog } from "./RoomDialogs";
import { RoomHeader } from "./RoomHeader";
import { Toolbar } from "./Toolbar";
import { VideoStage } from "./VideoStage";

interface MeetingRoomProps {
  meeting: MeetingRoomData;
  session: JoinSession;
  /** The user's "Mute my microphone when joining" setting. */
  muteOnJoin: boolean;
  onLeave: (endForAll: boolean) => Promise<void>;
}

/** The in-meeting experience: header, video stage, side panels and toolbar. */
export function MeetingRoom({ meeting, session, muteOnJoin, onLeave }: MeetingRoomProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const permission = useMedia((s) => s.permission);
  const mediaError = useMedia((s) => s.error);
  const panel = useRoom((s) => s.panel);
  const participants = useParticipants();

  const [participantId] = useState(() => String(100000 + Math.floor(Math.random() * 900000)));
  const [endOpen, setEndOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // Enter the room: register ourselves; release devices when leaving the page.
  useEffect(() => {
    useRoom.getState().init(meeting, {
      id: participantId,
      name: session.displayName,
      role: meeting.is_host ? "host" : "attendee",
      handRaised: false,
    });
    return () => {
      useMedia.getState().stopAll();
      useRoom.getState().reset();
    };
  }, [meeting, participantId, session.displayName]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function allowDevices() {
    // Host/participant video defaults come from the meeting's schedule settings.
    const videoDefault = meeting.is_host ? meeting.host_video : meeting.participant_video;
    void useMedia.getState().requestAccess({
      audio: session.joinAudio,
      video: session.videoOn && videoDefault,
      // "Mute participants upon entry" applies to everyone but the host.
      startMuted: muteOnJoin || (meeting.mute_on_entry && !meeting.is_host),
    });
  }

  async function leave(endForAll: boolean) {
    setLeaving(true);
    try {
      await onLeave(endForAll);
    } finally {
      setLeaving(false);
    }
  }

  const toggleFullscreen = () =>
    document.fullscreenElement
      ? void document.exitFullscreen()
      : void containerRef.current?.requestFullscreen();

  return (
    // On phones the meeting takes over the whole screen, like Zoom's mobile web client.
    <div
      ref={containerRef}
      className="relative flex h-full flex-col overflow-hidden bg-room text-white max-md:fixed max-md:inset-0 max-md:z-50"
    >
      <RoomHeader meeting={meeting} participantId={participantId} />

      <div className="relative flex min-h-0 flex-1">
        <VideoStage participants={participants} />
        {permission === "prompt" && (
          <PermissionPrompt
            onAllow={allowDevices}
            onSkip={() => useMedia.getState().skipAccess()}
            error={mediaError}
          />
        )}
        {panel === "participants" && (
          <ParticipantsPanel participants={participants} isHost={meeting.is_host} onInvite={() => setInviteOpen(true)} />
        )}
        {panel === "chat" && <ChatPanel participants={participants} />}
      </div>

      {endOpen ? (
        <EndMeetingBar
          isHost={meeting.is_host}
          busy={leaving}
          onEndForAll={() => void leave(true)}
          onLeave={() => void leave(false)}
          onCancel={() => setEndOpen(false)}
        />
      ) : (
        <Toolbar
          participantCount={participants.length}
          isHost={meeting.is_host}
          fullscreen={fullscreen}
          onToggleFullscreen={toggleFullscreen}
          onOpenSettings={() => setSettingsOpen(true)}
          onInvite={() => setInviteOpen(true)}
          onEnd={() => setEndOpen(true)}
        />
      )}

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <InviteDialog meeting={meeting} open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
