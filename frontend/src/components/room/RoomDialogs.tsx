"use client";

import { Copy, Link2 } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { copyInvitation, copyText } from "@/lib/clipboard";
import { formatMeetingCode } from "@/lib/format";
import { useMedia } from "@/lib/meeting/media";
import { useSpeaking } from "@/lib/meeting/useAudioLevel";
import type { MeetingRoom } from "@/lib/types";

import { VideoView } from "./VideoTile";

const darkSelect = "[&_select]:border-room-line [&_select]:bg-room-tile [&_select]:text-white";

/** Settings → Audio & Video: device pickers with a camera preview and mic test. */
export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const media = useMedia();
  const preview = useMemo(
    () => (media.videoTrack ? new MediaStream([media.videoTrack]) : null),
    [media.videoTrack],
  );
  const micActive = useSpeaking(media.audioTrack, open && !media.micMuted);

  return (
    <Modal open={open} onClose={onClose} tone="dark" title="Settings" className="max-w-[520px]">
      <div className="flex flex-col gap-5 pb-3 text-sm">
        <section>
          <h3 className="mb-2 font-semibold">Video</h3>
          <div className="mb-3 aspect-video overflow-hidden rounded-lg bg-room-tile">
            {preview ? (
              <VideoView stream={preview} mirrored />
            ) : (
              <p className="flex h-full items-center justify-center text-room-text-2">Your camera is off</p>
            )}
          </div>
          <label className="flex flex-col gap-1.5 text-room-text-2">
            Camera
            <Select
              className={darkSelect}
              value={media.camId ?? ""}
              onChange={(e) => void media.selectCamera(e.target.value)}
            >
              {media.devices.cams.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>
                  {d.label || `Camera ${i + 1}`}
                </option>
              ))}
            </Select>
          </label>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="font-semibold">Audio</h3>
          <label className="flex flex-col gap-1.5 text-room-text-2">
            Microphone
            <Select
              className={darkSelect}
              value={media.micId ?? ""}
              onChange={(e) => void media.selectMic(e.target.value)}
            >
              {media.devices.mics.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>
                  {d.label || `Microphone ${i + 1}`}
                </option>
              ))}
            </Select>
          </label>
          <p className="flex items-center gap-2 text-xs text-room-text-2">
            Input level
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-room-tile">
              <span
                className="block h-full rounded-full bg-[#23d959] transition-all"
                style={{ width: micActive ? "70%" : "4%" }}
              />
            </span>
            {media.micMuted && "(muted)"}
          </p>
          {media.devices.speakers.length > 0 && (
            <label className="flex flex-col gap-1.5 text-room-text-2">
              Speaker
              <Select
                className={darkSelect}
                value={media.speakerId ?? ""}
                onChange={(e) => media.selectSpeaker(e.target.value)}
              >
                {media.devices.speakers.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `Speaker ${i + 1}`}
                  </option>
                ))}
              </Select>
            </label>
          )}
        </section>
      </div>
    </Modal>
  );
}

/** "Invite" from the Participants panel: copy link or full invitation. */
export function InviteDialog({ meeting, open, onClose }: { meeting: MeetingRoom; open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} tone="dark" title={`Invite people to join meeting ${meeting.title}`}>
      <div className="flex flex-col gap-2 pb-2 text-sm">
        <p className="text-room-text-2">
          Meeting ID: <span className="text-white">{formatMeetingCode(meeting.meeting_code)}</span>
          {meeting.passcode && (
            <>
              {"  ·  "}Passcode: <span className="text-white">{meeting.passcode}</span>
            </>
          )}
        </p>
        <p className="truncate text-[#5c8dff]">{meeting.invite_link}</p>
      </div>
      <div className="flex justify-end gap-2 pt-3 pb-2">
        <Button variant="dark" onClick={() => void copyText(meeting.invite_link, "Invite link copied")}>
          <Link2 className="size-4" /> Copy Invite Link
        </Button>
        <Button onClick={() => void copyInvitation(meeting.id)}>
          <Copy className="size-4" /> Copy Invitation
        </Button>
      </div>
    </Modal>
  );
}
