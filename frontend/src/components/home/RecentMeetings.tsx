"use client";

import { History, Users } from "lucide-react";
import Link from "next/link";

import { formatDuration, formatMeetingCode } from "@/lib/format";
import { useMeetings } from "@/lib/queries";

function minutesBetween(a: string, b: string) {
  return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60_000));
}

/** Recently held meetings (hosted or attended), newest first. */
export function RecentMeetings() {
  const { data, isPending } = useMeetings("previous", 5);

  return (
    <section className="rounded-lg border border-line">
      <div className="flex h-12 items-center justify-between border-b border-line px-4">
        <h2 className="text-[15px] font-semibold">Recent meetings</h2>
        <Link href="/meetings?tab=previous" className="text-sm text-zoom-blue hover:underline">
          View all
        </Link>
      </div>

      {isPending ? (
        <div className="m-4 h-24 animate-pulse rounded-lg bg-shell" />
      ) : !data?.length ? (
        <p className="px-4 py-8 text-center text-sm text-ink-3">No recent meetings</p>
      ) : (
        <ul className="divide-y divide-line">
          {data.map((m) => {
            const started = new Date(m.started_at!);
            return (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-shell text-ink-2">
                  <History className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{m.title}</p>
                  <p className="truncate text-xs text-ink-3">
                    {started.toLocaleDateString("en-US", { month: "short", day: "numeric" })},{" "}
                    {started.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    {m.ended_at && ` · ${formatDuration(minutesBetween(m.started_at!, m.ended_at))}`}
                    {" · "}ID {formatMeetingCode(m.meeting_code)}
                  </p>
                </div>
                <span className="flex items-center gap-1 text-xs text-ink-3" title="Participants">
                  <Users className="size-3.5" /> {m.participant_count}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
