"use client";

import { ScheduleForm } from "@/components/meetings/ScheduleForm";
import { useMounted } from "@/lib/hooks";

export default function SchedulePage() {
  // Defaults (date, time zone) come from the browser, so render client-side only.
  const mounted = useMounted();
  return mounted ? <ScheduleForm /> : null;
}
