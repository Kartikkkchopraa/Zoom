"use client";

import clsx from "clsx";
import { Ellipsis, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { MenuItem, Popover } from "@/components/ui/Popover";
import { roomActions } from "@/lib/meeting/actions";
import { roleLabel } from "@/lib/meeting/participants";
import type { Participant } from "@/lib/meeting/room";
import { useRoom } from "@/lib/meeting/room";

import { SidePanel } from "./SidePanel";

export function ParticipantsPanel({
  participants,
  isHost,
  onInvite,
}: {
  participants: Participant[];
  isHost: boolean;
  onInvite: () => void;
}) {
  const setPanel = useRoom((s) => s.setPanel);
  const host = useRoom((s) => s.host);
  const [moreOpen, setMoreOpen] = useState(false);
  const [renaming, setRenaming] = useState<Participant | null>(null);

  return (
    <SidePanel
      title={`Participants (${participants.length})`}
      onClose={() => setPanel(null)}
      footer={
        <div className="flex shrink-0 items-center justify-between gap-2 p-5">
          <PanelButton onClick={onInvite}>Invite</PanelButton>
          {isHost && <PanelButton onClick={roomActions.muteAll}>Mute All</PanelButton>}
          {isHost && (
            <Popover
              open={moreOpen}
              onClose={() => setMoreOpen(false)}
              tone="dark"
              side="top"
              align="right"
              className="w-72"
              anchor={<PanelButton onClick={() => setMoreOpen((o) => !o)}>More</PanelButton>}
            >
              <MenuItem
                tone="dark"
                onClick={() => roomActions.setHostSetting({ allowUnmute: !host.allowUnmute })}
              >
                {host.allowUnmute ? "✓ " : ""}Allow Participants to Unmute Themselves
              </MenuItem>
              <MenuItem
                tone="dark"
                onClick={() => roomActions.setHostSetting({ allowRename: !host.allowRename })}
              >
                {host.allowRename ? "✓ " : ""}Allow Participants to Rename Themselves
              </MenuItem>
              <MenuItem tone="dark" onClick={() => roomActions.setHostSetting({ locked: !host.locked })}>
                {host.locked ? "✓ " : ""}Lock Meeting
              </MenuItem>
            </Popover>
          )}
        </div>
      }
    >
      <ul className="py-1">
        {participants.map((p) => (
          <ParticipantRow key={p.id} participant={p} onRename={() => setRenaming(p)} />
        ))}
      </ul>
      <RenameDialog participant={renaming} onClose={() => setRenaming(null)} />
    </SidePanel>
  );
}

function PanelButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-8 rounded-full bg-room-control px-6 text-[13px] text-[#e1e1e3] hover:bg-[#35363a]"
    >
      {children}
    </button>
  );
}

function ParticipantRow({ participant: p, onRename }: { participant: Participant; onRename: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const allowRename = useRoom((s) => s.host.allowRename);
  const canRename = p.isSelf && (allowRename || p.role !== "attendee");
  const speaking = useRoom((s) => s.speaking[p.id] ?? false);

  return (
    <li className="group flex h-12 items-center gap-3 px-6 hover:bg-white/5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-avatar text-base">
        {p.name.trim()[0]?.toUpperCase()}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">
        {p.name}
        <span className="text-room-text-2">{roleLabel(p)}</span>
      </span>
      {p.handRaised && (
        <span aria-label="Hand raised" className="text-base leading-none">
          ✋
        </span>
      )}
      {/* micMuted is also true when audio isn't connected */}
      {p.micMuted ? (
        <MicOff className="size-[18px] shrink-0 text-[#ff4d4f]" strokeWidth={1.8} />
      ) : (
        <Mic className={clsx("size-[18px] shrink-0", speaking && "text-[#23d959]")} strokeWidth={1.8} />
      )}
      {p.videoOn ? (
        <Video className="size-[18px] shrink-0" strokeWidth={1.8} />
      ) : (
        <VideoOff className="size-[18px] shrink-0 text-[#ff4d4f]" strokeWidth={1.8} />
      )}
      {p.isSelf && (
        <Popover
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          tone="dark"
          align="right"
          className="w-48"
          anchor={
            <button
              type="button"
              aria-label={`Options for ${p.name}`}
              onClick={() => setMenuOpen((o) => !o)}
              className="rounded p-1 hover:bg-white/10"
            >
              <Ellipsis className="size-5" />
            </button>
          }
        >
          {canRename && (
            <MenuItem tone="dark" onClick={() => (onRename(), setMenuOpen(false))}>
              Rename
            </MenuItem>
          )}
          <MenuItem tone="dark" onClick={() => (roomActions.toggleHand(), setMenuOpen(false))}>
            {p.handRaised ? "Lower Hand" : "Raise Hand"}
          </MenuItem>
        </Popover>
      )}
    </li>
  );
}

function RenameDialog({ participant, onClose }: { participant: Participant | null; onClose: () => void }) {
  return (
    <Modal open={participant !== null} onClose={onClose} tone="dark" title="Rename">
      {/* Keyed so the field starts from the current name each time it opens. */}
      {participant && <RenameForm key={participant.id} initial={participant.name} onClose={onClose} />}
    </Modal>
  );
}

function RenameForm({ initial, onClose }: { initial: string; onClose: () => void }) {
  const [name, setName] = useState(initial);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        roomActions.rename(name.trim());
        onClose();
      }}
    >
      <Input
        autoFocus
        aria-label="New name"
        value={name}
        maxLength={100}
        onChange={(e) => setName(e.target.value)}
        className="h-10 border-room-line bg-room-tile text-white"
      />
      <div className="flex justify-end gap-2 pt-5 pb-2">
        <Button variant="dark" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim() || name.trim() === initial}>
          Change
        </Button>
      </div>
    </form>
  );
}
