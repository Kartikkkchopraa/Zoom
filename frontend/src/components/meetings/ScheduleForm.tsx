"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { EmailChips } from "@/components/ui/EmailChips";
import { Checkbox, FormRow, Input, Radio, Select, Textarea } from "@/components/ui/Form";
import { MiniCalendar } from "@/components/ui/MiniCalendar";
import { Popover } from "@/components/ui/Popover";
import { api, ApiError, type ScheduleInput } from "@/lib/api";
import { formatMeetingCode } from "@/lib/format";
import { queryKeys, useMe } from "@/lib/queries";
import {
  browserTimeZone,
  timeZoneOptions,
  toWallClock,
  wallClockToIso,
  type WallClock,
} from "@/lib/timezones";
import { toast } from "@/lib/toast";
import type { Meeting } from "@/lib/types";

// 12:00, 12:30, 1:00 ... 11:30 (Zoom's 30-minute steps)
const TIME_SLOTS = Array.from({ length: 24 }, (_, i) => {
  const h = Math.floor(i / 2) % 12 || 12;
  return `${h}:${i % 2 ? "30" : "00"}`;
});
const DURATION_HOURS = Array.from({ length: 25 }, (_, i) => i);
// 40 is Zoom's default (the Basic-plan limit), so it is listed too.
const DURATION_MINUTES = [0, 15, 30, 40, 45];

function randomPasscode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

interface FormState {
  title: string;
  description: string;
  showDescription: boolean;
  date: Date; // local midnight of the chosen calendar day
  time: string; // '3:30'
  period: "AM" | "PM";
  durationHours: number;
  durationMinutes: number;
  timezone: string;
  invitees: string[];
  usePmi: boolean;
  passcode: string;
  waitingRoom: boolean;
  hostVideo: boolean;
  participantVideo: boolean;
  muteOnEntry: boolean;
}

function fromWallClock(w: WallClock): Pick<FormState, "date" | "time" | "period"> {
  return {
    date: new Date(w.year, w.month - 1, w.day),
    time: `${w.hour % 12 || 12}:${String(w.minute).padStart(2, "0")}`,
    period: w.hour < 12 ? "AM" : "PM",
  };
}

function initialState(meeting?: Meeting): FormState {
  if (meeting) {
    const tz = meeting.timezone;
    const when = meeting.scheduled_start
      ? fromWallClock(toWallClock(meeting.scheduled_start, tz))
      : fromWallClock(toWallClock(new Date().toISOString(), tz));
    const duration = meeting.duration_minutes ?? 40;
    return {
      title: meeting.title,
      description: meeting.description ?? "",
      showDescription: !!meeting.description,
      ...when,
      durationHours: Math.floor(duration / 60),
      durationMinutes: duration % 60,
      timezone: tz,
      invitees: meeting.invitees,
      usePmi: meeting.use_pmi,
      passcode: meeting.passcode ?? "",
      waitingRoom: meeting.waiting_room,
      hostVideo: meeting.host_video,
      participantVideo: meeting.participant_video,
      muteOnEntry: meeting.mute_on_entry,
    };
  }
  // Next half hour, in the browser's zone.
  const start = new Date();
  start.setMinutes(start.getMinutes() < 30 ? 30 : 60, 0, 0);
  return {
    title: "My Meeting",
    description: "",
    showDescription: false,
    ...fromWallClock({
      year: start.getFullYear(),
      month: start.getMonth() + 1,
      day: start.getDate(),
      hour: start.getHours(),
      minute: start.getMinutes(),
    }),
    durationHours: 0,
    durationMinutes: 40,
    timezone: browserTimeZone(),
    invitees: [],
    usePmi: false,
    passcode: randomPasscode(),
    waitingRoom: false,
    hostVideo: true,
    participantVideo: true,
    muteOnEntry: false,
  };
}

function toInput(s: FormState): ScheduleInput {
  const [h, m] = s.time.split(":").map(Number);
  const hour = (h % 12) + (s.period === "PM" ? 12 : 0);
  return {
    title: s.title.trim(),
    description: s.description.trim() || null,
    start_time: wallClockToIso({
      year: s.date.getFullYear(),
      month: s.date.getMonth() + 1,
      day: s.date.getDate(),
      hour,
      minute: m,
    }),
    duration_minutes: s.durationHours * 60 + s.durationMinutes,
    timezone: s.timezone,
    use_pmi: s.usePmi,
    passcode: s.usePmi ? null : s.passcode,
    waiting_room: s.waitingRoom,
    mute_on_entry: s.muteOnEntry,
    host_video: s.hostVideo,
    participant_video: s.participantVideo,
    invitees: s.invitees,
  };
}

/**
 * The Schedule Meeting page (zoom.us web portal layout).
 * - no `meeting`: schedule a new one
 * - scheduled `meeting`: edit it
 * - personal `meeting`: edit PMI settings (no topic/time)
 */
export function ScheduleForm({ meeting }: { meeting?: Meeting }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const [form, setForm] = useState(() => initialState(meeting));
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPmi = meeting?.meeting_type === "personal";
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));
  const zones = useMemo(() => timeZoneOptions(browserTimeZone(), form.timezone), [form.timezone]);
  // Keep values from an existing meeting selectable even if off the standard grid.
  const timeSlots = TIME_SLOTS.includes(form.time) ? TIME_SLOTS : [form.time, ...TIME_SLOTS];
  const minuteOptions = DURATION_MINUTES.includes(form.durationMinutes)
    ? DURATION_MINUTES
    : [...DURATION_MINUTES, form.durationMinutes].sort((a, b) => a - b);

  const save = useMutation({
    mutationFn: () => {
      const input = toInput(form);
      if (isPmi) {
        const { passcode, waiting_room, mute_on_entry, host_video, participant_video } = input;
        return api.updateMeeting(meeting!.id, { passcode, waiting_room, mute_on_entry, host_video, participant_video });
      }
      if (meeting) {
        // The meeting ID choice is fixed once scheduled.
        const editable: Partial<ScheduleInput> = { ...input };
        delete editable.use_pmi;
        if (meeting.use_pmi) delete editable.passcode;
        return api.updateMeeting(meeting.id, editable);
      }
      return api.schedule(input);
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.meetings });
      queryClient.invalidateQueries({ queryKey: queryKeys.me });
      toast(meeting ? "Meeting updated" : "Meeting scheduled", "success");
      router.push(`/meetings?id=${saved.id}`);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Couldn't save the meeting"),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isPmi && !form.title.trim()) return setError("Please enter a topic");
    if (!isPmi && form.durationHours * 60 + form.durationMinutes < 15)
      return setError("Duration must be at least 15 minutes");
    if (!isPmi && !form.usePmi && !form.passcode.trim()) return setError("Please enter a passcode");
    save.mutate();
  }

  const heading = isPmi ? "Edit Personal Meeting ID" : meeting ? "Edit Meeting" : "Schedule Meeting";

  return (
    <form onSubmit={submit} className="mx-auto max-w-[920px] px-4 py-6 md:px-10">
      <Link href="/meetings" className="flex w-fit items-center gap-1 text-[15px] text-zoom-blue hover:underline">
        <ChevronLeft className="size-4" /> Back to Meetings
      </Link>
      <h1 className="mt-4 mb-3 text-[22px] font-semibold">{heading}</h1>

      {error && (
        <div role="alert" className="mb-2 rounded-lg border border-zoom-red/30 bg-[#fdf1f1] px-4 py-2.5 text-sm text-zoom-red">
          {error}
        </div>
      )}

      {!isPmi && (
        <>
          <FormRow label="Topic" required>
            <Input
              autoFocus
              aria-label="Topic"
              value={form.title}
              maxLength={200}
              onChange={(e) => set({ title: e.target.value })}
              onFocus={(e) => !meeting && e.target.select()}
              className="max-w-[490px]"
            />
            {form.showDescription ? (
              <Textarea
                value={form.description}
                maxLength={2000}
                placeholder="Enter a description"
                onChange={(e) => set({ description: e.target.value })}
                className="mt-3 max-w-[490px]"
              />
            ) : (
              <button
                type="button"
                onClick={() => set({ showDescription: true })}
                className="mt-4 flex items-center gap-1 text-sm text-zoom-blue hover:underline"
              >
                <Plus className="size-4" /> Add Description
              </button>
            )}
          </FormRow>

          <FormRow label="When">
            <div className="flex flex-wrap gap-2">
              <Popover
                open={datePickerOpen}
                onClose={() => setDatePickerOpen(false)}
                anchor={
                  <button
                    type="button"
                    onClick={() => setDatePickerOpen((o) => !o)}
                    className="flex h-8 w-[240px] items-center justify-between rounded-lg border border-[#c5c9d0] bg-white px-3 text-sm"
                  >
                    {form.date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })}
                    <CalendarDays className="size-4 text-ink-2" />
                  </button>
                }
              >
                <MiniCalendar
                  value={form.date}
                  minDate={new Date()}
                  onChange={(date) => {
                    set({ date });
                    setDatePickerOpen(false);
                  }}
                />
              </Popover>
              <Select aria-label="Time" value={form.time} onChange={(e) => set({ time: e.target.value })} className="w-[168px]">
                {timeSlots.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
              <Select
                aria-label="AM or PM"
                value={form.period}
                onChange={(e) => set({ period: e.target.value as "AM" | "PM" })}
                className="w-[104px]"
              >
                <option>AM</option>
                <option>PM</option>
              </Select>
            </div>
          </FormRow>

          <FormRow label="Duration">
            <div className="flex items-center gap-2 text-sm">
              <Select
                aria-label="Duration hours"
                value={form.durationHours}
                onChange={(e) => set({ durationHours: Number(e.target.value) })}
                className="w-[136px]"
              >
                {DURATION_HOURS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </Select>
              hr
              <Select
                aria-label="Duration minutes"
                value={form.durationMinutes}
                onChange={(e) => set({ durationMinutes: Number(e.target.value) })}
                className="w-[150px]"
              >
                {minuteOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
              min
            </div>
          </FormRow>

          <FormRow label="Time Zone">
            <Select
              aria-label="Time zone"
              value={form.timezone}
              onChange={(e) => set({ timezone: e.target.value })}
              className="max-w-[490px]"
            >
              {zones.map((z) => (
                <option key={z.value} value={z.value}>
                  {z.label}
                </option>
              ))}
            </Select>
            <Checkbox
              className="mt-4"
              label="Recurring meeting"
              hint={<span className="text-xs">Recurring meetings aren&apos;t supported in this demo</span>}
              disabled
            />
          </FormRow>

          <FormRow label="Invitees">
            <div className="max-w-[490px]">
              <EmailChips
                value={form.invitees}
                onChange={(invitees) => set({ invitees })}
                placeholder="Enter email addresses"
              />
            </div>
          </FormRow>

          {!meeting && (
            <FormRow label="Meeting ID">
              <div className="flex flex-wrap gap-x-8 gap-y-2 pt-1.5">
                <Radio
                  name="meeting-id"
                  label="Generate Automatically"
                  checked={!form.usePmi}
                  onChange={() => set({ usePmi: false })}
                />
                <Radio
                  name="meeting-id"
                  label={`Personal Meeting ID ${me ? formatMeetingCode(me.personal_meeting.meeting_code) : ""}`}
                  checked={form.usePmi}
                  onChange={() => set({ usePmi: true })}
                />
              </div>
            </FormRow>
          )}
        </>
      )}

      {isPmi && (
        <FormRow label="Meeting ID">
          <p className="pt-1.5 text-sm">{formatMeetingCode(meeting.meeting_code)}</p>
        </FormRow>
      )}

      <FormRow label="Security">
        <div className="flex flex-col gap-4 pt-1">
          <div>
            <div className="flex items-center gap-3">
              <Checkbox label="Passcode" checked disabled />
              {form.usePmi ? (
                <span className="text-sm text-ink-2">Uses your Personal Meeting ID passcode</span>
              ) : (
                <Input
                  aria-label="Passcode"
                  value={form.passcode}
                  maxLength={10}
                  onChange={(e) => set({ passcode: e.target.value.replace(/[^A-Za-z0-9@*_-]/g, "") })}
                  className="w-[200px]"
                />
              )}
            </div>
            <p className="mt-1.5 ml-[26px] text-sm text-ink-2">
              Only users who have the invite link or passcode can join the meeting
            </p>
          </div>
          <Checkbox
            label="Waiting Room"
            hint="Only users admitted by the host can join the meeting"
            checked={form.waitingRoom}
            onChange={(e) => set({ waitingRoom: e.target.checked })}
          />
        </div>
      </FormRow>

      <div className="my-2 border-t border-line md:ml-[186px]" />

      <FormRow label="Encryption">
        <div className="flex flex-wrap gap-x-8 gap-y-2 pt-1.5">
          <Radio
            name="encryption"
            label={
              <span className="flex items-center gap-1">
                <ShieldCheck className="size-4 text-green-600" /> Enhanced encryption
              </span>
            }
            checked
            readOnly
          />
        </div>
      </FormRow>

      <FormRow label="Video">
        <div className="grid w-fit grid-cols-[110px_auto_auto] items-center gap-x-8 gap-y-3 pt-1.5 text-sm">
          <span>Host</span>
          <Radio name="host-video" label="on" checked={form.hostVideo} onChange={() => set({ hostVideo: true })} />
          <Radio name="host-video" label="off" checked={!form.hostVideo} onChange={() => set({ hostVideo: false })} />
          <span>Participant</span>
          <Radio
            name="participant-video"
            label="on"
            checked={form.participantVideo}
            onChange={() => set({ participantVideo: true })}
          />
          <Radio
            name="participant-video"
            label="off"
            checked={!form.participantVideo}
            onChange={() => set({ participantVideo: false })}
          />
        </div>
      </FormRow>

      <FormRow label="Options">
        {showOptions ? (
          <div className="flex flex-col gap-3 pt-1.5">
            <Checkbox
              label="Mute participants upon entry"
              checked={form.muteOnEntry}
              onChange={(e) => set({ muteOnEntry: e.target.checked })}
            />
            <button type="button" onClick={() => setShowOptions(false)} className="w-fit text-sm text-zoom-blue hover:underline">
              Hide
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setShowOptions(true)} className="pt-1.5 text-sm text-zoom-blue hover:underline">
            Show
          </button>
        )}
      </FormRow>

      <div className="mt-6 flex gap-3">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
        <Button variant="soft" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
