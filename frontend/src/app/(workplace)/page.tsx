"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { CalendarPanel } from "@/components/home/CalendarPanel";
import { HomeActions } from "@/components/home/HomeActions";
import { HomeClock } from "@/components/home/HomeClock";
import type { MeetingAction } from "@/components/home/MeetingCard";
import { QuickLinks } from "@/components/home/QuickLinks";
import { RecentMeetings } from "@/components/home/RecentMeetings";
import { JoinMeetingModal } from "@/components/join/JoinMeetingModal";
import { useMounted } from "@/lib/hooks";
import { useMe } from "@/lib/queries";
import type { Meeting } from "@/lib/types";
import { useLaunchMeeting } from "@/lib/useLaunchMeeting";

export default function HomePage() {
  const router = useRouter();
  const mounted = useMounted();
  const { data: me } = useMe();
  const launcher = useLaunchMeeting();
  const [joinOpen, setJoinOpen] = useState(false);

  const onMeetingAction = (meeting: Meeting, action: MeetingAction) =>
    action === "start" ? launcher.startMeeting(meeting) : launcher.joinInvited(meeting);

  return (
    <div className="mx-auto flex w-full max-w-[632px] flex-col gap-6 px-4 pt-14 pb-8">
      <HomeClock />
      <HomeActions
        pmi={me?.personal_meeting.meeting_code}
        busy={launcher.busy}
        onNewMeeting={launcher.newMeeting}
        onJoin={() => setJoinOpen(true)}
        onSchedule={() => router.push("/meetings/schedule")}
      />
      <QuickLinks />
      {/* Calendar depends on the browser's local "today", so render it client-side only. */}
      {mounted ? (
        <CalendarPanel currentUserId={me?.user.id} onAction={onMeetingAction} />
      ) : (
        <div className="h-[480px] rounded-lg border border-line" />
      )}
      <RecentMeetings />
      <JoinMeetingModal open={joinOpen} onClose={() => setJoinOpen(false)} />
    </div>
  );
}
