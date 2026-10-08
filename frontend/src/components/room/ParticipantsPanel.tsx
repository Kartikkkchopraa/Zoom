"use client";

import clsx from "clsx";
import { Check, Ellipsis, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Checkbox, Input } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { MenuDivider, MenuItem, Popover } from "@/components/ui/Popover";
import { roomActions } from "@/lib/meeting/actions";
import { roleLabel } from "@/lib/meeting/participants";
import type { HostSettings, Participant } from "@/lib/meeting/room";
import { useRoom } from "@/lib/meeting/room";

import { SidePanel } from "./SidePanel";

export function ParticipantsPanel({
  participants,
  isHost,
  onInvite,
}: {
  participants: Participant[];
  /** Host or co-host: shows moderation controls. */
  isHost: boolean;
  onInvite: () => void;
}) {
  const setPanel = useRoom((s) => s.setPanel);
  const waitingList = useRoom((s) => s.waitingList);
  const [renaming, setRenaming] = useState<Participant | null>(null);
  const [removing, setRemoving] = useState<Participant | null>(null);
  const [muteAllOpen, setMuteAllOpen] = useState(false);

  return (
    <SidePanel
      title={`Participants (${participants.length})`}
      onClose={() => setPanel(null)}
      footer={
        <div className="flex shrink-0 items-center justify-between gap-2 p-5">
          <PanelButton onClick={onInvite}>Invite</PanelButton>
          {isHost && <PanelButton onClick={() => setMuteAllOpen(true)}>Mute All</PanelButton>}
          {isHost && <PanelMoreMenu />}
        </div>
      }
    >
      {isHost && waitingList.length > 0 && (
        <section className="border-b border-room-line pb-2">
          <div className="flex items-center justify-between px-6 pt-2 pb-1">
            <h3 className="text-xs font-semibold text-room-text-2">Waiting Room ({waitingList.length})</h3>
            <button type="button" onClick={() => roomActions.admit()} className="text-xs text-[#7aa2ff] hover:underline">
              Admit all
            </button>
          </div>
          <ul>
            {waitingList.map((w) => (
              <li key={w.id} className="flex h-11 items-center gap-3 px-6">
                <Avatar name={w.name} />
                <span className="min-w-0 flex-1 truncate text-sm">{w.name}</span>
                <SmallButton onClick={() => roomActions.deny(w.id)}>Remove</SmallButton>
                <SmallButton primary onClick={() => roomActions.admit(w.id)}>
                  Admit
                </SmallButton>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className="py-1">
        {participants.map((p) => (
          <ParticipantRow
            key={p.id}
            participant={p}
            canModerate={isHost}
            onRename={() => setRenaming(p)}
            onRemove={() => setRemoving(p)}
          />
        ))}
      </ul>

      <RenameDialog participant={renaming} onClose={() => setRenaming(null)} />
      <RemoveDialog participant={removing} onClose={() => setRemoving(null)} />
      <MuteAllDialog open={muteAllOpen} onClose={() => setMuteAllOpen(false)} />
    </SidePanel>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-avatar text-base">
      {name.trim()[0]?.toUpperCase()}
    </span>
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

function SmallButton({
  children,
  onClick,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "h-7 rounded-md px-3 text-xs whitespace-nowrap",
        primary ? "bg-zoom-blue text-white hover:bg-zoom-blue-hover" : "bg-room-control text-[#e1e1e3] hover:bg-[#35363a]",
      )}
    >
      {children}
    </button>
  );
}

/** Footer "More": meeting-wide permissions (sent to the server for everyone). */
function PanelMoreMenu() {
  const [open, setOpen] = useState(false);
  const host = useRoom((s) => s.host);
  const item = (key: keyof HostSettings, label: string) => (
    <MenuItem tone="dark" onClick={() => roomActions.setHostSetting({ [key]: !host[key] })}>
      <span className="flex w-4 justify-center">{host[key] && <Check className="size-4 text-[#5c8dff]" />}</span>
      {label}
    </MenuItem>
  );
  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      tone="dark"
      side="top"
      align="right"
      className="w-80"
      anchor={<PanelButton onClick={() => setOpen((o) => !o)}>More</PanelButton>}
    >
      <MenuItem tone="dark" onClick={() => (roomActions.askToUnmute(), setOpen(false))}>
        <span className="w-4" />
        Ask All to Unmute
      </MenuItem>
      <MenuDivider tone="dark" />
      {item("allowUnmute", "Allow Participants to Unmute Themselves")}
      {item("allowRename", "Allow Participants to Rename Themselves")}
      {item("waitingRoom", "Enable Waiting Room")}
      {item("locked", "Lock Meeting")}
    </Popover>
  );
}

function ParticipantRow({
  participant: p,
  canModerate,
  onRename,
  onRemove,
}: {
  participant: Participant;
  canModerate: boolean;
  onRename: () => void;
  onRemove: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const allowRename = useRoom((s) => s.host.allowRename);
  const myRole = useRoom((s) => s.self?.role);
  const speaking = useRoom((s) => s.speaking[p.id] ?? false);

  const canRename = p.isSelf && (allowRename || p.role !== "attendee");
  // A co-host can't act on the host; nobody moderates themselves.
  const moderate = canModerate && !p.isSelf && !(p.role === "host" && myRole !== "host");

  return (
    <li className="group flex h-12 items-center gap-3 px-6 hover:bg-white/5">
      <Avatar name={p.name} />
      <span className="min-w-0 flex-1 truncate text-sm">
        {p.name}
        <span className="text-room-text-2">{roleLabel(p)}</span>
      </span>

      {/* Moderators see Mute / Ask to Unmute on hover, in place of the status icons. */}
      {moderate && p.audioConnected && (
        <span className={clsx(!menuOpen && "hidden group-hover:block")}>
          {p.micMuted ? (
            <SmallButton onClick={() => roomActions.askToUnmute(p.id)}>Ask to Unmute</SmallButton>
          ) : (
            <SmallButton onClick={() => roomActions.mute(p.id)}>Mute</SmallButton>
          )}
        </span>
      )}
      <span
        className={clsx(
          "flex items-center gap-3",
          moderate && p.audioConnected && (menuOpen ? "hidden" : "group-hover:hidden"),
        )}
      >
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
      </span>

      {(p.isSelf || moderate) && (
        <Popover
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          tone="dark"
          align="right"
          className="w-60"
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
          {p.isSelf ? (
            <>
              {canRename && (
                <MenuItem tone="dark" onClick={() => (onRename(), setMenuOpen(false))}>
                  Rename
                </MenuItem>
              )}
              <MenuItem tone="dark" onClick={() => (roomActions.toggleHand(), setMenuOpen(false))}>
                {p.handRaised ? "Lower Hand" : "Raise Hand"}
              </MenuItem>
            </>
          ) : (
            <>
              {myRole === "host" && (
                <>
                  <MenuItem tone="dark" onClick={() => (roomActions.setRole(p.id, "host"), setMenuOpen(false))}>
                    Make Host
                  </MenuItem>
                  <MenuItem
                    tone="dark"
                    onClick={() => (
                      roomActions.setRole(p.id, p.role === "co_host" ? "attendee" : "co_host"), setMenuOpen(false)
                    )}
                  >
                    {p.role === "co_host" ? "Withdraw Co-Host Permission" : "Make Co-Host"}
                  </MenuItem>
                  <MenuDivider tone="dark" />
                </>
              )}
              <MenuItem tone="dark" className="text-[#ff6b6b]" onClick={() => (onRemove(), setMenuOpen(false))}>
                Remove
              </MenuItem>
            </>
          )}
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

function RemoveDialog({ participant, onClose }: { participant: Participant | null; onClose: () => void }) {
  return (
    <Modal
      open={participant !== null}
      onClose={onClose}
      tone="dark"
      title={`Remove ${participant?.name ?? ""}?`}
      footer={
        <>
          <Button variant="dark" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (participant) roomActions.remove(participant.id);
              onClose();
            }}
          >
            Remove
          </Button>
        </>
      }
    >
      <p className="text-sm text-room-text-2">They won&apos;t be able to rejoin this meeting.</p>
    </Modal>
  );
}

function MuteAllDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} tone="dark" title="Mute all current and new participants">
      {/* Keyed by open so the checkbox starts from the current setting each time. */}
      {open && <MuteAllForm onClose={onClose} />}
    </Modal>
  );
}

function MuteAllForm({ onClose }: { onClose: () => void }) {
  const [allow, setAllow] = useState(useRoom.getState().host.allowUnmute);
  return (
    <>
      <Checkbox
        label={<span className="text-white">Allow participants to unmute themselves</span>}
        checked={allow}
        onChange={(e) => setAllow(e.target.checked)}
      />
      <div className="flex justify-end gap-2 pt-5 pb-2">
        <Button variant="dark" onClick={onClose}>
          No
        </Button>
        <Button
          onClick={() => {
            roomActions.muteAll(allow);
            onClose();
          }}
        >
          Yes
        </Button>
      </div>
    </>
  );
}
