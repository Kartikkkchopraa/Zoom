"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { api, ApiError } from "./api";
import { useMeetingPrefs } from "./prefs";
import { queryKeys } from "./queries";
import { useJoinSessions, type JoinSession } from "./session";
import { toast } from "./toast";
import type { Me, Meeting } from "./types";

/**
 * Every way into a meeting room (new instant meeting, starting a scheduled
 * one, joining one) ends the same way: remember the join session, refresh
 * meeting lists, and navigate to /wc/<code>.
 */
export function useLaunchMeeting() {
  const router = useRouter();
  const queryClient = useQueryClient();
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

  // The profile supplies the display name and join settings. A fast click can
  // beat the initial /me request, so wait for it rather than use placeholders.
  const loadMe = () => queryClient.ensureQueryData<Me>({ queryKey: queryKeys.me, queryFn: api.me });

  const hostSession = (meeting: Meeting, me: Me): JoinSession => ({
    displayName: me.user.name,
    credential: meeting.meeting_code,
    joinAudio: true,
    videoOn: useMeetingPrefs.getState().startWithVideo && !me.settings.video_off_on_join,
    asHost: true,
  });

  /** "New meeting": instant meeting (or the PMI room, per the ▾ menu) as host. */
  const newMeeting = () =>
    run(async () => {
      const [me, meeting] = await Promise.all([loadMe(), api.createInstant(useMeetingPrefs.getState().usePmi)]);
      enterRoom(meeting.meeting_code, hostSession(meeting, me));
    });

  /** "Start" on a meeting the user hosts. */
  const startMeeting = (meeting: Meeting) =>
    run(async () => {
      const [me, started] = await Promise.all([loadMe(), api.startMeeting(meeting.id)]);
      enterRoom(started.meeting_code, hostSession(started, me));
    });

  /** "Join" on a meeting the user was invited to; the invite link skips the passcode. */
  const joinInvited = (meeting: Meeting) =>
    run(async () => {
      const [me, room] = await Promise.all([loadMe(), api.joinCheck(meeting.invite_link)]);
      enterRoom(room.meeting_code, {
        displayName: me.user.name,
        credential: meeting.invite_link,
        joinAudio: true,
        videoOn: !me.settings.video_off_on_join,
        asHost: false,
      });
    });

  return { busy, newMeeting, startMeeting, joinInvited, enterRoom };
}
