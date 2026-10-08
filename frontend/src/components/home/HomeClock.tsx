"use client";

import { formatClock } from "@/lib/format";
import { useNow } from "@/lib/hooks";

export function HomeClock() {
  const now = useNow();
  return (
    <div className="text-center" suppressHydrationWarning>
      <p className="h-[52px] text-[44px] leading-[52px] font-semibold tracking-tight text-ink">
        {now && formatClock(now)}
      </p>
      <p className="mt-1 h-6 text-[17px] text-ink-2">
        {now?.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
      </p>
    </div>
  );
}
