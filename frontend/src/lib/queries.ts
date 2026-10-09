"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "./api";
import { addDays } from "./format";
import type { MeetingScope } from "./types";

// Central query keys so mutations can invalidate exactly what changed.
export const queryKeys = {
  me: ["me"] as const,
  meetings: ["meetings"] as const,
  meetingList: (scope: MeetingScope) => ["meetings", "list", scope] as const,
  calendarDay: (day: Date) => ["meetings", "calendar", day.toISOString()] as const,
  meeting: (id: number) => ["meetings", "detail", id] as const,
};

export const useMe = ({ enabled = true } = {}) =>
  useQuery({ queryKey: queryKeys.me, queryFn: api.me, enabled });

export const useMeetings = (scope: MeetingScope, limit = 50) =>
  useQuery({ queryKey: queryKeys.meetingList(scope), queryFn: () => api.listMeetings(scope, limit) });

/** Meetings on one local calendar day; `day` must be a local midnight. */
export const useCalendarDay = (day: Date) =>
  useQuery({
    queryKey: queryKeys.calendarDay(day),
    queryFn: () => api.calendar(day, addDays(day, 1)),
  });
