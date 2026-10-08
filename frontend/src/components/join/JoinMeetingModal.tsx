"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Checkbox, Input } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { api, ApiError } from "@/lib/api";
import { useMe } from "@/lib/queries";
import { useRememberedName } from "@/lib/session";
import { useLaunchMeeting } from "@/lib/useLaunchMeeting";

const PASSCODE_ERRORS = new Set(["passcode_required", "wrong_passcode"]);

/** Home → Join: meeting ID or invite link + display name, then passcode if needed. */
export function JoinMeetingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: me } = useMe();
  const remembered = useRememberedName();
  const { enterRoom } = useLaunchMeeting();

  const [meeting, setMeeting] = useState("");
  const [name, setName] = useState<string | null>(null); // null = use default
  const [rememberName, setRememberName] = useState(true);
  const [noAudio, setNoAudio] = useState(false);
  const [videoOff, setVideoOff] = useState(false);

  const [step, setStep] = useState<"details" | "passcode">("details");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const displayName = (name ?? remembered.name ?? me?.user.name ?? "").trimStart();

  function reset() {
    setStep("details");
    setPasscode("");
    setError(null);
    setBusy(false);
  }

  function close() {
    reset();
    setMeeting("");
    onClose();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const room = await api.joinCheck(meeting, step === "passcode" ? passcode : undefined);
      remembered.setName(rememberName ? displayName.trim() : null);
      enterRoom(room.meeting_code, {
        displayName: displayName.trim(),
        credential: meeting.trim(),
        passcode: step === "passcode" ? passcode : undefined,
        joinAudio: !noAudio,
        videoOn: !videoOff,
        asHost: false,
      });
      close();
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError && PASSCODE_ERRORS.has(err.code)) {
        // First time: just ask for the passcode; afterwards show the error.
        if (step === "passcode") setError(err.message);
        setStep("passcode");
        return;
      }
      setError(err instanceof ApiError ? err.message : "Unable to join. Please try again.");
    }
  }

  const canSubmit =
    step === "details" ? meeting.trim() !== "" && displayName.trim() !== "" : passcode !== "";

  return (
    <Modal
      open={open}
      onClose={close}
      title={step === "details" ? "Join meeting" : "Enter meeting passcode"}
    >
      <form id="join-form" onSubmit={submit} className="flex flex-col gap-3 pb-2">
        {step === "details" ? (
          <>
            <Input
              autoFocus
              aria-label="Meeting ID or invite link"
              placeholder="Meeting ID or invite link"
              value={meeting}
              onChange={(e) => setMeeting(e.target.value)}
              className="h-10"
            />
            <Input
              aria-label="Your name"
              placeholder="Enter your name"
              value={displayName}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              className="h-10"
            />
            <div className="mt-1 flex flex-col gap-2.5">
              <Checkbox
                label="Remember my name for future meetings"
                checked={rememberName}
                onChange={(e) => setRememberName(e.target.checked)}
              />
              <Checkbox
                label="Don't connect to audio"
                checked={noAudio}
                onChange={(e) => setNoAudio(e.target.checked)}
              />
              <Checkbox
                label="Turn off my video"
                checked={videoOff}
                onChange={(e) => setVideoOff(e.target.checked)}
              />
            </div>
          </>
        ) : (
          <Input
            autoFocus
            type="password"
            aria-label="Meeting passcode"
            placeholder="Meeting passcode"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            className="h-10"
          />
        )}
        {error && (
          <p role="alert" className="text-sm text-zoom-red">
            {error}
          </p>
        )}
      </form>
      <div className="flex justify-end gap-2 pt-3 pb-2">
        <Button variant="secondary" onClick={step === "details" ? close : reset}>
          {step === "details" ? "Cancel" : "Back"}
        </Button>
        <Button type="submit" form="join-form" disabled={!canSubmit || busy}>
          {step === "details" ? "Join" : "Join meeting"}
        </Button>
      </div>
    </Modal>
  );
}
