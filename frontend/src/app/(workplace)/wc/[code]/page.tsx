"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useRef } from "react";

import { Button } from "@/components/ui/Button";
import { api, ApiError } from "@/lib/api";
import { formatMeetingCode } from "@/lib/format";
import { useMounted } from "@/lib/hooks";
import { queryKeys } from "@/lib/queries";
import { useJoinSessions } from "@/lib/session";

/**
 * Meeting room entry point. Re-validates the stored join session (so refresh
 * works and direct URL access without credentials is bounced to the join page).
 * The full room UI is built in Phase 4.
 */
export default function MeetingRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const mounted = useMounted();
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useJoinSessions((s) => s.sessions[code]);
  const clearSession = useJoinSessions((s) => s.clear);

  // Set while leaving, so clearing the session doesn't trigger the redirect below.
  const leavingRef = useRef(false);

  useEffect(() => {
    if (mounted && !session && !leavingRef.current) router.replace(`/wc/${code}/join`);
  }, [mounted, session, code, router]);

  const room = useQuery({
    queryKey: ["room", code, session?.credential],
    queryFn: () => api.joinCheck(session!.credential, session!.passcode),
    enabled: mounted && !!session,
    retry: false,
  });

  async function leave(endForAll: boolean) {
    leavingRef.current = true;
    if (endForAll && room.data) await api.endMeeting(room.data.id);
    clearSession(code);
    queryClient.invalidateQueries({ queryKey: queryKeys.meetings });
    router.push("/");
  }

  return (
    <div className="flex h-full flex-col bg-room text-white">
      <div className="flex h-12 items-center gap-2 px-3 text-sm font-semibold">
        <Info className="size-4" /> {room.data?.title ?? ""}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        {room.error ? (
          <>
            <p className="text-lg">{room.error instanceof ApiError ? room.error.message : "Unable to join"}</p>
            <Button onClick={() => router.push("/")}>Back to Home</Button>
          </>
        ) : room.data ? (
          <>
            <p className="text-lg">
              You&apos;re in <span className="font-semibold">{room.data.title}</span> as{" "}
              <span className="font-semibold">{session?.displayName}</span>
              {room.data.is_host && " (Host)"}
            </p>
            <p className="text-sm text-white/60">Meeting ID {formatMeetingCode(room.data.meeting_code)}</p>
            <p className="text-sm text-white/60">The meeting room UI is built in Phase 4.</p>
          </>
        ) : (
          <p className="text-white/60">Connecting…</p>
        )}
      </div>
      {room.data && (
        <div className="flex justify-end gap-2 p-3">
          {room.data.is_host && (
            <Button variant="danger" onClick={() => leave(true)}>
              End Meeting for All
            </Button>
          )}
          <Button variant="secondary" className="border-0 bg-[#2e2f33] text-white hover:bg-[#3a3b40]" onClick={() => leave(false)}>
            Leave Meeting
          </Button>
        </div>
      )}
    </div>
  );
}
