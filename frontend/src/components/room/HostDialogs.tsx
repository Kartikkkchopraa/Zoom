"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Radio } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { roomActions } from "@/lib/meeting/actions";
import type { Participant } from "@/lib/meeting/room";
import { useRoom } from "@/lib/meeting/room";

/** "The host would like you to unmute" — shown after Ask to Unmute. */
export function UnmuteRequestDialog() {
  const by = useRoom((s) => s.unmuteRequestBy);
  const dismiss = () => useRoom.getState().setUnmuteRequest(null);
  return (
    <Modal
      open={by !== null}
      onClose={dismiss}
      tone="dark"
      title={`${by ?? "The host"} would like you to unmute`}
      footer={
        <>
          <Button variant="dark" onClick={dismiss}>
            Stay Muted
          </Button>
          <Button onClick={roomActions.acceptUnmuteRequest}>Unmute</Button>
        </>
      }
    >
      <p className="text-sm text-room-text-2">Your microphone is currently muted.</p>
    </Modal>
  );
}

/** Leaving as host with others present: pick who takes over (Zoom's "Assign a new host"). */
export function AssignHostDialog({
  open,
  candidates,
  onCancel,
  onAssign,
}: {
  open: boolean;
  candidates: Participant[];
  onCancel: () => void;
  onAssign: (peerId: string) => void;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const selected = chosen ?? candidates.find((p) => p.role === "co_host")?.id ?? candidates[0]?.id;
  return (
    <Modal
      open={open}
      onClose={onCancel}
      tone="dark"
      title="Assign a new host"
      footer={
        <>
          <Button variant="dark" onClick={onCancel}>
            Cancel
          </Button>
          <Button disabled={!selected} onClick={() => selected && onAssign(selected)}>
            Assign and Leave
          </Button>
        </>
      }
    >
      <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
        {candidates.map((p) => (
          <li key={p.id}>
            <Radio
              name="new-host"
              checked={selected === p.id}
              onChange={() => setChosen(p.id)}
              label={
                <span className="text-white">
                  {p.name}
                  {p.role === "co_host" && <span className="text-room-text-2"> (Co-host)</span>}
                </span>
              }
            />
          </li>
        ))}
      </ul>
    </Modal>
  );
}
