"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { CalendarPlus, ChevronLeft, RotateCw } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { MeetingDetail } from "@/components/meetings/MeetingDetail";
import { MeetingList } from "@/components/meetings/MeetingList";
import { api } from "@/lib/api";
import { queryKeys, useMe, useMeetings } from "@/lib/queries";
import { toast } from "@/lib/toast";
import type { MeetingScope } from "@/lib/types";

export default function MeetingsPage() {
  return (
    <Suspense>
      <MeetingsView />
    </Suspense>
  );
}

function MeetingsView() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const tab: MeetingScope = params.get("tab") === "previous" ? "previous" : "upcoming";
  const idParam = params.get("id") ? Number(params.get("id")) : null;

  const { data: me } = useMe();
  const { data: meetings = [], isPending, isFetching } = useMeetings(tab);
  // The URL still holds a deleted meeting's id until navigation settles; don't refetch it.
  const [deletedId, setDeletedId] = useState<number | null>(null);
  const pmi = tab === "upcoming" ? me?.personal_meeting : undefined;

  // Default selection: the PMI on Upcoming, the most recent meeting on Previous.
  const selectedId = idParam ?? pmi?.id ?? meetings[0]?.id ?? null;
  const fromLists = [pmi, ...meetings].find((m) => m?.id === selectedId);
  // A meeting linked from Home may not be in the current list; fetch it directly.
  const { data: fetched } = useQuery({
    queryKey: queryKeys.meeting(selectedId ?? 0),
    queryFn: () => api.getMeeting(selectedId!),
    enabled: selectedId !== null && selectedId !== deletedId && !fromLists && !isPending,
  });
  const selected = fromLists ?? fetched;

  const navigate = (next: { tab?: MeetingScope; id?: number | null }) => {
    const q = new URLSearchParams();
    const t = next.tab ?? tab;
    if (t === "previous") q.set("tab", "previous");
    const id = next.id === undefined ? idParam : next.id;
    if (id) q.set("id", String(id));
    router.replace(`/meetings${q.size ? `?${q}` : ""}`);
  };

  return (
    <div className="flex h-full">
      <aside
        className={clsx(
          "flex w-full shrink-0 flex-col border-r border-line md:w-[360px]",
          idParam !== null && "hidden md:flex",
        )}
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <button
            type="button"
            aria-label="Refresh"
            title="Refresh"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: queryKeys.meetings });
              queryClient.invalidateQueries({ queryKey: queryKeys.me });
            }}
            className="rounded p-1 text-ink-2 hover:bg-shell"
          >
            <RotateCw className={clsx("size-4", isFetching && "animate-spin")} />
          </button>
          <div className="flex gap-1 rounded-lg bg-shell p-0.5" role="tablist">
            {(["upcoming", "previous"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => navigate({ tab: t, id: null })}
                className={clsx(
                  "rounded-md px-3 py-1 text-[15px] font-semibold capitalize",
                  tab === t ? "bg-white text-ink shadow-sm" : "text-ink-2 hover:text-ink",
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <Link
            href="/meetings/schedule"
            aria-label="Schedule a meeting"
            title="Schedule a meeting"
            className="rounded p-1 text-ink-2 hover:bg-shell"
          >
            <CalendarPlus className="size-4" />
          </Link>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isPending ? (
            <div className="mx-4 mt-2 h-20 animate-pulse rounded-lg bg-shell" />
          ) : (
            <MeetingList
              meetings={meetings}
              pmi={pmi}
              selectedId={selectedId}
              onSelect={(id) => navigate({ id })}
              emptyText={tab === "upcoming" ? "No upcoming meetings" : "No previous meetings"}
            />
          )}
        </div>

        <div className="border-t border-line py-3 text-center">
          <button
            type="button"
            onClick={() => toast("Calendar integration isn't available in this demo")}
            className="text-sm text-zoom-blue underline"
          >
            Add a calendar
          </button>
        </div>
      </aside>

      <section className={clsx("min-w-0 flex-1 overflow-y-auto", idParam === null && "hidden md:block")}>
        <button
          type="button"
          onClick={() => navigate({ id: null })}
          className="mt-4 ml-4 flex items-center gap-1 text-sm text-zoom-blue md:hidden"
        >
          <ChevronLeft className="size-4" /> Meetings
        </button>
        {selected && (
          <MeetingDetail
            key={selected.id}
            meeting={selected}
            currentUserId={me?.user.id}
            onDeleted={() => {
              setDeletedId(selected.id);
              navigate({ id: null });
            }}
          />
        )}
      </section>
    </div>
  );
}
