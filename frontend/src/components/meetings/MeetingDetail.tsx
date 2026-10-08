"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { api, ApiError } from "@/lib/api";
import { copyInvitation } from "@/lib/clipboard";
import { formatDayLabel, formatDuration, formatMeetingCode, formatTimeRange, meetingEnd, meetingStart, startOfDay } from "@/lib/format";
import { queryKeys } from "@/lib/queries";
import { toast } from "@/lib/toast";
import type { Meeting } from "@/lib/types";
import { useLaunchMeeting } from "@/lib/useLaunchMeeting";

interface MeetingDetailProps {
  meeting: Meeting;
  currentUserId?: number;
  onDeleted: () => void;
}

/** Right side of the Meetings tab: title, time, ID and the action buttons. */
export function MeetingDetail({ meeting, currentUserId, onDeleted }: MeetingDetailProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const launcher = useLaunchMeeting();
  const [showInvitation, setShowInvitation] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isHost = meeting.host.id === currentUserId;
  const isPmi = meeting.meeting_type === "personal";
  const ended = meeting.status === "ended";
  const start = meetingStart(meeting);
  const end = meetingEnd(meeting);

  const invitation = useQuery({
    queryKey: [...queryKeys.meeting(meeting.id), "invitation"],
    queryFn: () => api.invitation(meeting.id),
    enabled: showInvitation,
  });

  const remove = useMutation({
    mutationFn: () => api.deleteMeeting(meeting.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.meetings });
      toast("Meeting deleted", "success");
      setConfirmDelete(false);
      onDeleted();
    },
    onError: (err) => toast(err instanceof ApiError ? err.message : "Couldn't delete the meeting", "error"),
  });

  return (
    <div className="px-6 py-10 md:px-10">
      <h1 className="text-2xl font-semibold text-ink">{isPmi ? "My Personal Meeting ID (PMI)" : meeting.title}</h1>

      <div className="mt-4 flex flex-col gap-1.5 text-sm text-ink">
        {!isPmi && start && end && (
          <p>
            {formatDayLabel(startOfDay(start))} · {formatTimeRange(start, end)}
            {meeting.duration_minutes && !ended && (
              <span className="text-ink-3"> ({formatDuration(meeting.duration_minutes)})</span>
            )}
          </p>
        )}
        <p>{isPmi ? formatMeetingCode(meeting.meeting_code) : `Meeting ID: ${formatMeetingCode(meeting.meeting_code)}`}</p>
        {!isPmi && <p className="text-ink-2">Host: {meeting.host.name}</p>}
        {ended && meeting.participant_count > 0 && (
          <p className="text-ink-2">
            {meeting.participant_count} {meeting.participant_count === 1 ? "participant" : "participants"}
          </p>
        )}
        {meeting.description && <p className="mt-2 max-w-xl whitespace-pre-line text-ink-2">{meeting.description}</p>}
      </div>

      <div className="mt-8 flex flex-wrap gap-4">
        {!ended &&
          (isHost ? (
            <Button disabled={launcher.busy} onClick={() => launcher.startMeeting(meeting)} className="min-w-[75px]">
              {meeting.status === "live" ? "Join" : "Start"}
            </Button>
          ) : (
            <Button disabled={launcher.busy} onClick={() => launcher.joinInvited(meeting)} className="min-w-[75px]">
              Join
            </Button>
          ))}
        <Button variant="secondary" onClick={() => copyInvitation(meeting.id)}>
          <Copy className="size-3.5" /> Copy Invitation
        </Button>
        {isHost && !ended && (
          <Button variant="secondary" onClick={() => router.push(`/meetings/${meeting.id}/edit`)}>
            <Pencil className="size-3.5" /> Edit
          </Button>
        )}
        {isHost && !isPmi && meeting.status !== "live" && (
          <Button variant="secondary" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-3.5" /> Delete
          </Button>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowInvitation((s) => !s)}
        className="mt-14 text-sm text-zoom-blue underline-offset-2 hover:underline aria-expanded:underline"
        aria-expanded={showInvitation}
      >
        {showInvitation ? "Hide Meeting Invitation" : "Show Meeting Invitation"}
      </button>
      {showInvitation && (
        <pre className="mt-3 font-sans text-sm leading-relaxed whitespace-pre-wrap text-ink">
          {invitation.data?.text ?? "Loading…"}
        </pre>
      )}

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete meeting"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutate()}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">
          Are you sure you want to delete <span className="font-semibold text-ink">{meeting.title}</span>? Invitees
          won&apos;t be able to join with the old link.
        </p>
      </Modal>
    </div>
  );
}
