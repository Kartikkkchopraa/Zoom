"use client";

import { useEffect, useRef, useState } from "react";

import { MeetingConnection, setCurrentConnection } from "@/lib/meeting/connection";
import { useMedia } from "@/lib/meeting/media";
import { useParticipants } from "@/lib/meeting/participants";
import { useRoom } from "@/lib/meeting/room";
import type { JoinSession } from "@/lib/session";
import type { MeetingRoom as MeetingRoomData } from "@/lib/types";

import { ChatPanel } from "./ChatPanel";
import { EndMeetingBar } from "./EndMeetingBar";
import { ParticipantsPanel } from "./ParticipantsPanel";
import { PermissionPrompt } from "./PermissionPrompt";
import { RemoteAudio } from "./RemoteAudio";
import { InviteDialog, SettingsDialog } from "./RoomDialogs";
import { RoomHeader } from "./RoomHeader";
import { RoomStatus } from "./RoomStatus";
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
  const connectionRef = useRef<MeetingConnection | null>(null);
  const permission = useMedia((s) => s.permission);
  const mediaError = useMedia((s) => s.error);
  const panel = useRoom((s) => s.panel);
  const status = useRoom((s) => s.status);
  const statusMessage = useRoom((s) => s.statusMessage);
  const retryable = useRoom((s) => s.retryable);
  const self = useRoom((s) => s.self);
  const participants = useParticipants();

  const [attempt, setAttempt] = useState(0); // bumped by "Rejoin"
  const [endOpen, setEndOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const isHost = self?.role === "host";
  const canUseHostTools = self?.role === "host" || self?.role === "co_host";

  // Enter the room: register ourselves and connect; disconnect when leaving the page.
  useEffect(() => {
    useRoom.getState().init(meeting, {
      id: "",
      participantId: null,
      name: session.displayName,
      role: meeting.is_host && session.asHost ? "host" : "attendee",
      handRaised: false,
    });
    const connection = new MeetingConnection(meeting.meeting_code, {
      token: meeting.join_token,
      name: session.displayName,
      asHost: session.asHost,
    });
    connectionRef.current = connection;
    setCurrentConnection(connection);
    void connection.start();
    return () => {
      connection.leave();
      setCurrentConnection(null);
      connectionRef.current = null;
    };
  }, [meeting, session.displayName, session.asHost, attempt]);

  // Dropped connection: retry automatically a few times before showing "Rejoin".
  const autoRetries = useRef(0);
  useEffect(() => {
    if (status === "joined") autoRetries.current = 0;
    if (status !== "error" || !retryable || autoRetries.current >= 3) return;
    const delay = 1000 * 2 ** autoRetries.current++;
    const timer = setTimeout(() => setAttempt((n) => n + 1), delay);
    return () => clearTimeout(timer);
  }, [status, retryable]);

  // Devices and room state outlive reconnects; release them only when the room unmounts.
  useEffect(
    () => () => {
      useMedia.getState().stopAll();
      useRoom.getState().reset();
    },
    [],
  );

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function allowDevices() {
    // Host/participant video defaults come from the meeting's schedule settings.
    const videoDefault = session.asHost ? meeting.host_video : meeting.participant_video;
    void useMedia.getState().requestAccess({
      audio: session.joinAudio,
      video: session.videoOn && videoDefault,
      // "Mute participants upon entry" applies to everyone but the host.
      startMuted: muteOnJoin || (meeting.mute_on_entry && !session.asHost),
    });
  }

  async function leave(endForAll: boolean) {
    setLeaving(true);
    connectionRef.current?.leave();
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
      <RoomHeader meeting={meeting} participantId={self?.participantId ? String(self.participantId) : "—"} />

      <div className="relative flex min-h-0 flex-1">
        <VideoStage participants={participants} />
        {status === "joined" && permission === "prompt" && (
          <PermissionPrompt
            onAllow={allowDevices}
            onSkip={() => useMedia.getState().skipAccess()}
            error={mediaError}
          />
        )}
        {status === "joined" && panel === "participants" && (
          <ParticipantsPanel participants={participants} isHost={canUseHostTools} onInvite={() => setInviteOpen(true)} />
        )}
        {status === "joined" && panel === "chat" && <ChatPanel participants={participants} />}
        <RoomStatus
          status={status}
          message={statusMessage}
          meeting={meeting}
          onLeave={() => void leave(false)}
          onRejoin={() => setAttempt((n) => n + 1)}
        />
      </div>

      {status !== "joined" ? null : endOpen ? (
        <EndMeetingBar
          isHost={isHost}
          busy={leaving}
          onEndForAll={() => void leave(true)}
          onLeave={() => void leave(false)}
          onCancel={() => setEndOpen(false)}
        />
      ) : (
        <Toolbar
          participantCount={participants.length}
          isHost={canUseHostTools}
          fullscreen={fullscreen}
          onToggleFullscreen={toggleFullscreen}
          onOpenSettings={() => setSettingsOpen(true)}
          onInvite={() => setInviteOpen(true)}
          onEnd={() => setEndOpen(true)}
        />
      )}

      <RemoteAudio participants={participants} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <InviteDialog meeting={meeting} open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
