"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { api, ApiError } from "./api";
import { useMeetingPrefs } from "./prefs";
import { queryKeys, useMe } from "./queries";
import { useJoinSessions, type JoinSession } from "./session";
import { toast } from "./toast";
import type { Meeting } from "./types";

/**
 * Every way into a meeting room (new instant meeting, starting a scheduled
 * one, joining one) ends the same way: remember the join session, refresh
 * meeting lists, and navigate to /wc/<code>.
 */
export function useLaunchMeeting() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const saveSession = useJoinSessions((s) => s.save);
  const [busy, setBusy] = useState(false);

  function enterRoom(code: string, session: JoinSession) {
    saveSession(code, session);
    queryClient.invalidateQueries({ queryKey: queryKeys.meetings });
    router.push(`/wc/${code}`);
  }

  async function run(task: () => Promise<void>) {
    setBusy(true);
    try {
      await task();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Something went wrong", "error");
    } finally {
      setBusy(false);
    }
  }

  const hostSession = (meeting: Meeting): JoinSession => ({
    displayName: me?.user.name ?? "Host",
    credential: meeting.meeting_code,
    joinAudio: true,
    videoOn: useMeetingPrefs.getState().startWithVideo && !me?.settings.video_off_on_join,
    asHost: true,
  });

  /** "New meeting": instant meeting (or the PMI room, per the ▾ menu) as host. */
  const newMeeting = () =>
    run(async () => {
      const meeting = await api.createInstant(useMeetingPrefs.getState().usePmi);
      enterRoom(meeting.meeting_code, hostSession(meeting));
    });

  /** "Start" on a meeting the user hosts. */
  const startMeeting = (meeting: Meeting) =>
    run(async () => {
      const started = await api.startMeeting(meeting.id);
      enterRoom(started.meeting_code, hostSession(started));
    });

  /** "Join" on a meeting the user was invited to; the invite link skips the passcode. */
  const joinInvited = (meeting: Meeting) =>
    run(async () => {
      const room = await api.joinCheck(meeting.invite_link);
      enterRoom(room.meeting_code, {
        displayName: me?.user.name ?? "Guest",
        credential: meeting.invite_link,
        joinAudio: true,
        videoOn: !me?.settings.video_off_on_join,
        asHost: false,
      });
    });

  return { busy, newMeeting, startMeeting, joinInvited, enterRoom };
}
