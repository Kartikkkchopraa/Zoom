"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { use, useEffect, useRef } from "react";

import { MeetingRoom } from "@/components/room/MeetingRoom";
import { Button } from "@/components/ui/Button";
import { api, ApiError } from "@/lib/api";
import { useMounted } from "@/lib/hooks";
import { queryKeys, useMe } from "@/lib/queries";
import { useJoinSessions } from "@/lib/session";

/**
 * Meeting room route. Re-validates the stored join session (so refresh works
 * and opening the URL without credentials bounces to the join page), then
 * renders the room.
 */
export default function MeetingRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const mounted = useMounted();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
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
    staleTime: Infinity, // validated once per visit; don't re-check on window focus
  });

  async function leave() {
    leavingRef.current = true;
    clearSession(code);
    queryClient.invalidateQueries({ queryKey: queryKeys.meetings });
    router.push("/");
  }

  if (room.error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-room px-6 text-center text-white">
        <p className="text-lg">{room.error instanceof ApiError ? room.error.message : "Unable to join this meeting"}</p>
        <Button onClick={() => router.push("/")}>Back to Home</Button>
      </div>
    );
  }

  if (!room.data || !session) {
    return (
      <div className="flex h-full items-center justify-center bg-room text-sm text-white/60">Connecting…</div>
    );
  }

  return (
    <MeetingRoom
      meeting={room.data}
      session={session}
      muteOnJoin={me?.settings.mute_mic_on_join ?? true}
      onLeave={leave}
    />
  );
}
