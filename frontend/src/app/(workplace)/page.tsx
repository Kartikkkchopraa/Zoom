"use client";

import { CalendarPanel } from "@/components/home/CalendarPanel";
import { HomeActions } from "@/components/home/HomeActions";
import { HomeClock } from "@/components/home/HomeClock";
import { QuickLinks } from "@/components/home/QuickLinks";
import { RecentMeetings } from "@/components/home/RecentMeetings";
import { useMounted } from "@/lib/hooks";
import { useMe } from "@/lib/queries";
import { toast } from "@/lib/toast";

export default function HomePage() {
  const mounted = useMounted();
  const { data: me } = useMe();

  // Wired to real flows in Phase 3 (instant meeting, join, schedule, start).
  const notYet = () => toast("Coming in Phase 3");

  return (
    <div className="mx-auto flex w-full max-w-[632px] flex-col gap-6 px-4 pt-14 pb-8">
      <HomeClock />
      <HomeActions
        pmi={me?.personal_meeting.meeting_code}
        onNewMeeting={notYet}
        onJoin={notYet}
        onSchedule={notYet}
      />
      <QuickLinks />
      {/* Calendar depends on the browser's local "today", so render it client-side only. */}
      {mounted ? (
        <CalendarPanel currentUserId={me?.user.id} onAction={notYet} />
      ) : (
        <div className="h-[480px] rounded-lg border border-line" />
      )}
      <RecentMeetings />
    </div>
  );
}
