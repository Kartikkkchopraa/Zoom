import type { Meeting } from "./types";

/** '72087405307' -> '720 8740 5307', '2920816742' -> '292 081 6742' (Zoom grouping). */
export function formatMeetingCode(code: string): string {
  if (code.length === 11) return `${code.slice(0, 3)} ${code.slice(3, 7)} ${code.slice(7)}`;
  if (code.length === 10) return `${code.slice(0, 3)} ${code.slice(3, 6)} ${code.slice(6)}`;
  return code;
}

function time(d: Date, withPeriod = true): string {
  const text = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return withPeriod ? text : text.replace(/\s?[AP]M$/, "");
}

export const formatClock = (d: Date) => time(d);

/** '2:30 - 3:10 AM', or '11:30 AM - 12:10 PM' when the period changes. */
export function formatTimeRange(start: Date, end: Date): string {
  const samePeriod = start.getHours() < 12 === end.getHours() < 12;
  return `${time(start, !samePeriod)} - ${time(end)}`;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

export const isSameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();

/** 'Today, Oct 9' / 'Tomorrow, Oct 10' / 'Sat, Oct 11'. */
export function formatDayLabel(d: Date, now = new Date()): string {
  const monthDay = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (isSameDay(d, now)) return `Today, ${monthDay}`;
  if (isSameDay(d, addDays(now, 1))) return `Tomorrow, ${monthDay}`;
  if (isSameDay(d, addDays(now, -1))) return `Yesterday, ${monthDay}`;
  return `${d.toLocaleDateString("en-US", { weekday: "short" })}, ${monthDay}`;
}

/** When the meeting starts (scheduled) or started (instant/personal). */
export function meetingStart(m: Meeting): Date | null {
  const iso = m.scheduled_start ?? m.started_at;
  return iso ? new Date(iso) : null;
}

export function meetingEnd(m: Meeting): Date | null {
  if (m.ended_at && m.status === "ended") return new Date(m.ended_at);
  const start = meetingStart(m);
  if (!start) return null;
  return new Date(start.getTime() + (m.duration_minutes ?? 40) * 60_000);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h && `${h} hr`, m && `${m} min`].filter(Boolean).join(" ") || "0 min";
}
