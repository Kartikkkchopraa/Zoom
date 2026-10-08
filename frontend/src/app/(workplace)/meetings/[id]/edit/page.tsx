"use client";

import { useQuery } from "@tanstack/react-query";
import { use } from "react";

import { ScheduleForm } from "@/components/meetings/ScheduleForm";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queries";

export default function EditMeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number(use(params).id);
  const { data: meeting, error } = useQuery({
    queryKey: queryKeys.meeting(id),
    queryFn: () => api.getMeeting(id),
  });

  if (error) return <p className="p-10 text-sm text-zoom-red">{error.message}</p>;
  if (!meeting) return <div className="m-10 h-40 animate-pulse rounded-lg bg-shell" />;
  return <ScheduleForm meeting={meeting} />;
}
