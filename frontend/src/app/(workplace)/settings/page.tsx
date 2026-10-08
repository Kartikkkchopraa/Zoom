"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Mic, UserRound, Video } from "lucide-react";
import { useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Form";
import { Toggle } from "@/components/ui/Toggle";
import { api, ApiError } from "@/lib/api";
import { formatMeetingCode } from "@/lib/format";
import { useMeetingPrefs } from "@/lib/prefs";
import { queryKeys, useMe } from "@/lib/queries";
import { toast } from "@/lib/toast";
import type { Me, UserSettings } from "@/lib/types";

const SECTIONS = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "audio", label: "Audio", icon: Mic },
  { id: "video", label: "Video", icon: Video },
] as const;
type Section = (typeof SECTIONS)[number]["id"];

export default function SettingsPage() {
  const { data: me } = useMe();
  const [section, setSection] = useState<Section>("profile");

  return (
    <div className="flex h-full flex-col md:flex-row">
      <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-line p-3 md:w-56 md:flex-col md:border-r md:border-b-0 md:p-4">
        <h1 className="hidden px-3 pb-3 text-lg font-semibold md:block">Settings</h1>
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSection(id)}
            className={clsx(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm whitespace-nowrap",
              section === id ? "bg-zoom-blue-soft font-semibold text-zoom-blue" : "text-ink-2 hover:bg-shell",
            )}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </nav>

      <div className="min-w-0 flex-1 overflow-y-auto px-5 py-6 md:px-10">
        {!me ? (
          <div className="h-40 animate-pulse rounded-lg bg-shell" />
        ) : section === "profile" ? (
          <ProfileSection me={me} />
        ) : section === "audio" ? (
          <AudioSection me={me} />
        ) : (
          <VideoSection me={me} />
        )}
      </div>
    </div>
  );
}

function useSaveSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<UserSettings>) => api.updateSettings(patch),
    onSuccess: (me) => queryClient.setQueryData(queryKeys.me, me),
    onError: () => toast("Couldn't save the setting", "error"),
  });
}

function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-line py-5">
      <div>
        <p className="text-[15px] font-semibold">{title}</p>
        <p className="mt-1 max-w-xl text-sm text-ink-2">{description}</p>
      </div>
      {children}
    </div>
  );
}

function ProfileSection({ me }: { me: Me }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(me.user.name);
  const save = useMutation({
    mutationFn: () => api.updateMe({ name: name.trim() }),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.me, updated);
      toast("Profile updated", "success");
    },
    onError: (err) => toast(err instanceof ApiError ? err.message : "Couldn't update profile", "error"),
  });

  return (
    <section className="max-w-2xl">
      <h2 className="text-xl font-semibold">Profile</h2>
      <div className="mt-6 flex items-center gap-4">
        <Avatar name={me.user.name} color={me.user.avatar_color} size={64} />
        <div>
          <p className="text-lg font-semibold">{me.user.name}</p>
          <p className="text-sm text-ink-2">{me.user.email}</p>
        </div>
      </div>

      <form
        className="mt-8 flex max-w-md flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <label htmlFor="display-name" className="text-sm font-semibold">
          Display name
        </label>
        <div className="flex gap-2">
          <Input id="display-name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} className="h-9" />
          <Button type="submit" disabled={!name.trim() || name.trim() === me.user.name || save.isPending}>
            Save
          </Button>
        </div>
      </form>

      <dl className="mt-8 grid max-w-md grid-cols-[160px_1fr] gap-y-3 text-sm">
        <dt className="text-ink-2">Personal Meeting ID</dt>
        <dd>{formatMeetingCode(me.personal_meeting.meeting_code)}</dd>
        <dt className="text-ink-2">Time zone</dt>
        <dd>{me.user.timezone}</dd>
      </dl>
    </section>
  );
}

function AudioSection({ me }: { me: Me }) {
  const save = useSaveSettings();
  return (
    <section className="max-w-2xl">
      <h2 className="text-xl font-semibold">Audio</h2>
      <SettingRow
        title="Mute my microphone when joining a meeting"
        description="You'll join muted and can unmute from the meeting toolbar."
      >
        <Toggle
          label="Mute my microphone when joining a meeting"
          checked={me.settings.mute_mic_on_join}
          onChange={(v) => save.mutate({ mute_mic_on_join: v })}
        />
      </SettingRow>
    </section>
  );
}

function VideoSection({ me }: { me: Me }) {
  const save = useSaveSettings();
  const { startWithVideo, set } = useMeetingPrefs();
  return (
    <section className="max-w-2xl">
      <h2 className="text-xl font-semibold">Video</h2>
      <SettingRow
        title="Turn off my video when joining a meeting"
        description="Your camera stays off until you click Start Video."
      >
        <Toggle
          label="Turn off my video when joining a meeting"
          checked={me.settings.video_off_on_join}
          onChange={(v) => save.mutate({ video_off_on_join: v })}
        />
      </SettingRow>
      <SettingRow
        title="Start new meetings with video"
        description='Same as "Start with video" in the New meeting menu on Home (saved in this browser).'
      >
        <Toggle label="Start new meetings with video" checked={startWithVideo} onChange={(v) => set({ startWithVideo: v })} />
      </SettingRow>
    </section>
  );
}
