"use client";

import clsx from "clsx";
import {
  Check,
  Ellipsis,
  Hand,
  Headphones,
  Heart,
  Maximize,
  MessageSquare,
  Mic,
  MicOff,
  Minimize,
  Settings,
  ShieldCheck,
  SquareArrowUp,
  TriangleAlert,
  UserPlus,
  Users,
  Video,
  VideoOff,
  X,
  LayoutGrid,
  Square,
  Link2,
} from "lucide-react";
import { useState } from "react";

import { MenuDivider, MenuItem, MenuLabel, Popover } from "@/components/ui/Popover";
import { copyText } from "@/lib/clipboard";
import { roomActions } from "@/lib/meeting/actions";
import { useMedia } from "@/lib/meeting/media";
import { useRoom } from "@/lib/meeting/room";

import { ToolbarButton } from "./ToolbarButton";

type Menu = "audio" | "video" | "participants" | "chat" | "react" | "share" | "host" | "more" | null;

const REACTIONS = ["👏", "👍", "❤️", "😂", "😮", "🎉"];

interface ToolbarProps {
  participantCount: number;
  isHost: boolean;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  onOpenSettings: () => void;
  onInvite: () => void;
  onEnd: () => void;
}

export function Toolbar({
  participantCount,
  isHost,
  fullscreen,
  onToggleFullscreen,
  onOpenSettings,
  onInvite,
  onEnd,
}: ToolbarProps) {
  const [menu, setMenu] = useState<Menu>(null);
  const toggle = (m: Exclude<Menu, null>) => setMenu((cur) => (cur === m ? null : m));
  const close = () => setMenu(null);

  const media = useMedia();
  const panel = useRoom((s) => s.panel);
  const togglePanel = useRoom((s) => s.togglePanel);
  const unreadChat = useRoom((s) => s.unreadChat);
  const view = useRoom((s) => s.view);
  const setView = useRoom((s) => s.setView);
  const handRaised = useRoom((s) => s.self?.handRaised ?? false);
  const host = useRoom((s) => s.host);
  const meeting = useRoom((s) => s.meeting);

  const audioIcon = !media.audioConnected ? (
    <Headphones className="size-[26px]" strokeWidth={1.5} />
  ) : media.micMuted ? (
    <MicOff className="size-[26px] text-[#ff4d4f]" strokeWidth={1.5} />
  ) : (
    <Mic className="size-[26px]" strokeWidth={1.5} />
  );
  const audioLabel = !media.audioConnected ? "Join Audio" : media.micMuted ? "Unmute" : "Mute";
  const camOn = !!media.videoTrack;
  const noDevicePermission = media.permission === "denied";

  const dark = "dark" as const;
  const menuProps = { tone: dark, side: "top" as const, onClose: close };

  return (
    <div className="flex h-16 shrink-0 items-center justify-between bg-room-bar px-2 sm:px-4">
      {/* Left: audio + video */}
      <div className="flex items-center gap-1">
        <Popover
          {...menuProps}
          open={menu === "audio"}
          className="w-72"
          anchor={
            <ToolbarButton
              icon={audioIcon}
              label={audioLabel}
              onClick={roomActions.toggleMic}
              onCaret={() => toggle("audio")}
            />
          }
        >
          <DeviceList
            title="Select a Microphone"
            devices={media.devices.mics}
            selected={media.micId}
            onSelect={(id) => void media.selectMic(id).then(close)}
          />
          <DeviceList
            title="Select a Speaker"
            devices={media.devices.speakers}
            selected={media.speakerId}
            onSelect={(id) => {
              media.selectSpeaker(id);
              close();
            }}
          />
          <MenuDivider tone={dark} />
          <MenuItem tone={dark} onClick={() => (onOpenSettings(), close())}>
            Audio Settings…
          </MenuItem>
        </Popover>

        <Popover
          {...menuProps}
          open={menu === "video"}
          className="w-72"
          anchor={
            <ToolbarButton
              icon={
                <span className="relative">
                  {camOn ? (
                    <Video className="size-[26px]" strokeWidth={1.5} />
                  ) : (
                    <VideoOff className="size-[26px] text-[#ff4d4f]" strokeWidth={1.5} />
                  )}
                  {noDevicePermission && (
                    <TriangleAlert className="absolute -right-1.5 -bottom-1 size-3.5 fill-[#ff4d4f] text-room-bar" />
                  )}
                </span>
              }
              label={camOn ? "Stop Video" : "Start Video"}
              onClick={roomActions.toggleCamera}
              onCaret={() => toggle("video")}
            />
          }
        >
          <DeviceList
            title="Select a Camera"
            devices={media.devices.cams}
            selected={media.camId}
            onSelect={(id) => void media.selectCamera(id).then(close)}
          />
          <MenuDivider tone={dark} />
          <MenuItem tone={dark} onClick={() => (onOpenSettings(), close())}>
            Video Settings…
          </MenuItem>
        </Popover>
      </div>

      {/* Center */}
      <div className="flex items-center gap-0.5 sm:gap-1">
        <Popover
          {...menuProps}
          open={menu === "participants"}
          align="center"
          className="w-48"
          anchor={
            <ToolbarButton
              icon={<Users className="size-[26px]" strokeWidth={1.5} />}
              label="Participants"
              badge={participantCount}
              active={panel === "participants"}
              onClick={() => togglePanel("participants")}
              onCaret={() => toggle("participants")}
            />
          }
        >
          <MenuItem tone={dark} onClick={() => (onInvite(), close())}>
            <UserPlus className="size-4" /> Invite
          </MenuItem>
        </Popover>

        <Popover
          {...menuProps}
          open={menu === "chat"}
          align="center"
          className="w-64"
          anchor={
            <ToolbarButton
              className="hidden sm:flex"
              icon={<MessageSquare className="size-[26px]" strokeWidth={1.5} />}
              label="Chat"
              badge={unreadChat > 0 ? <UnreadDot count={unreadChat} /> : undefined}
              active={panel === "chat"}
              onClick={() => togglePanel("chat")}
              onCaret={isHost ? () => toggle("chat") : undefined}
            />
          }
        >
          <MenuLabel tone={dark}>Participants can chat with:</MenuLabel>
          <CheckItem checked={host.allowChat} onClick={() => roomActions.setHostSetting({ allowChat: true })}>
            Everyone
          </CheckItem>
          <CheckItem checked={!host.allowChat} onClick={() => roomActions.setHostSetting({ allowChat: false })}>
            No one
          </CheckItem>
        </Popover>

        <Popover
          {...menuProps}
          open={menu === "react"}
          align="center"
          className="w-[300px] px-3 py-3"
          anchor={
            <ToolbarButton
              className="hidden md:flex"
              icon={<Heart className="size-[26px]" strokeWidth={1.5} />}
              label="React"
              onClick={() => toggle("react")}
            />
          }
        >
          <div className="flex justify-between">
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={`React ${emoji}`}
                onClick={() => (roomActions.react(emoji), close())}
                className="rounded-md p-1.5 text-2xl hover:bg-white/10"
              >
                {emoji}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => (roomActions.toggleHand(), close())}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-room-control py-2 text-sm hover:bg-[#35363a]"
          >
            <span aria-hidden>✋</span>
            {handRaised ? "Lower Hand" : "Raise Hand"}
          </button>
        </Popover>

        <Popover
          {...menuProps}
          open={menu === "share"}
          align="center"
          className="w-64"
          anchor={
            <ToolbarButton
              className="hidden md:flex"
              icon={<SquareArrowUp className={clsx("size-[26px]", media.screenTrack && "text-[#23d959]")} strokeWidth={1.5} />}
              label={media.screenTrack ? "Stop Share" : "Share"}
              onClick={() => void roomActions.toggleShare()}
              onCaret={isHost ? () => toggle("share") : undefined}
            />
          }
        >
          <MenuLabel tone={dark}>Who can share?</MenuLabel>
          <CheckItem checked={host.allowShare} onClick={() => roomActions.setHostSetting({ allowShare: true })}>
            All participants
          </CheckItem>
          <CheckItem checked={!host.allowShare} onClick={() => roomActions.setHostSetting({ allowShare: false })}>
            Only host
          </CheckItem>
        </Popover>

        {isHost && (
          <Popover
            {...menuProps}
            open={menu === "host"}
            align="center"
            className="w-72"
            anchor={
              <ToolbarButton
                className="hidden md:flex"
                icon={<ShieldCheck className="size-[26px]" strokeWidth={1.5} />}
                label="Host tools"
                onClick={() => toggle("host")}
              />
            }
          >
            <HostToolsMenu />
          </Popover>
        )}

        <Popover
          {...menuProps}
          open={menu === "more"}
          align="right"
          className="w-64"
          anchor={
            <ToolbarButton
              icon={<Ellipsis className="size-[22px] rounded-full ring-[1.5px] ring-current" strokeWidth={2} />}
              label="More"
              onClick={() => toggle("more")}
            />
          }
        >
          {/* Small screens: the controls hidden from the toolbar live here. */}
          <div className="md:hidden">
            <MenuItem tone={dark} className="sm:hidden" onClick={() => (togglePanel("chat"), close())}>
              <MessageSquare className="size-4" /> Chat {unreadChat > 0 && `(${unreadChat})`}
            </MenuItem>
            <MenuItem tone={dark} onClick={() => (void roomActions.toggleShare(), close())}>
              <SquareArrowUp className="size-4" /> {media.screenTrack ? "Stop Share" : "Share Screen"}
            </MenuItem>
            <MenuItem tone={dark} onClick={() => (roomActions.toggleHand(), close())}>
              <Hand className="size-4" /> {handRaised ? "Lower Hand" : "Raise Hand"}
            </MenuItem>
            <div className="flex justify-between px-3 py-1">
              {REACTIONS.map((emoji) => (
                <button key={emoji} type="button" onClick={() => (roomActions.react(emoji), close())} className="p-1 text-xl">
                  {emoji}
                </button>
              ))}
            </div>
            <MenuDivider tone={dark} />
          </div>
          <MenuItem tone={dark} onClick={() => (setView(view === "speaker" ? "gallery" : "speaker"), close())}>
            {view === "speaker" ? <LayoutGrid className="size-4" /> : <Square className="size-4" />}
            {view === "speaker" ? "Gallery View" : "Speaker View"}
          </MenuItem>
          <MenuItem tone={dark} onClick={() => (onToggleFullscreen(), close())}>
            {fullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
            {fullscreen ? "Exit Full Screen" : "Enter Full Screen"}
          </MenuItem>
          {meeting && (
            <MenuItem tone={dark} onClick={() => (void copyText(meeting.invite_link, "Invite link copied"), close())}>
              <Link2 className="size-4" /> Copy Invite Link
            </MenuItem>
          )}
          <MenuItem tone={dark} onClick={() => (onOpenSettings(), close())}>
            <Settings className="size-4" /> Settings
          </MenuItem>
        </Popover>
      </div>

      {/* Right: End */}
      <ToolbarButton
        icon={
          <span className="flex size-[26px] items-center justify-center rounded-[7px] border-[1.5px] border-[#ff4d4f] bg-[#ff4d4f]/10">
            <X className="size-4 text-[#ff4d4f]" strokeWidth={2.5} />
          </span>
        }
        label={isHost ? "End" : "Leave"}
        onClick={onEnd}
      />
    </div>
  );
}

function UnreadDot({ count }: { count: number }) {
  return (
    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-zoom-end px-1 text-[10px] font-semibold">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function CheckItem({
  checked,
  onClick,
  children,
}: {
  checked: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <MenuItem tone="dark" onClick={onClick}>
      <span className="flex w-4 justify-center">{checked && <Check className="size-4 text-[#5c8dff]" />}</span>
      {children}
    </MenuItem>
  );
}

export function DeviceList({
  title,
  devices,
  selected,
  onSelect,
}: {
  title: string;
  devices: MediaDeviceInfo[];
  selected: string | null;
  onSelect: (deviceId: string) => void;
}) {
  if (!devices.length) return null;
  return (
    <>
      <MenuLabel tone="dark">{title}</MenuLabel>
      {devices.map((d, i) => (
        <CheckItem key={d.deviceId || i} checked={d.deviceId === selected} onClick={() => onSelect(d.deviceId)}>
          <span className="truncate">{d.label || `Device ${i + 1}`}</span>
        </CheckItem>
      ))}
    </>
  );
}

function HostToolsMenu() {
  const host = useRoom((s) => s.host);
  const set = roomActions.setHostSetting;
  return (
    <>
      <MenuLabel tone="dark">Security</MenuLabel>
      <CheckItem checked={host.locked} onClick={() => set({ locked: !host.locked })}>
        Lock Meeting
      </CheckItem>
      <CheckItem checked={host.waitingRoom} onClick={() => set({ waitingRoom: !host.waitingRoom })}>
        Enable Waiting Room
      </CheckItem>
      <MenuDivider tone="dark" />
      <MenuLabel tone="dark">Allow all participants to:</MenuLabel>
      <CheckItem checked={host.allowShare} onClick={() => set({ allowShare: !host.allowShare })}>
        Share Screen
      </CheckItem>
      <CheckItem checked={host.allowChat} onClick={() => set({ allowChat: !host.allowChat })}>
        Chat
      </CheckItem>
      <CheckItem checked={host.allowRename} onClick={() => set({ allowRename: !host.allowRename })}>
        Rename Themselves
      </CheckItem>
      <CheckItem checked={host.allowUnmute} onClick={() => set({ allowUnmute: !host.allowUnmute })}>
        Unmute Themselves
      </CheckItem>
    </>
  );
}
