"use client";

import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { isSameDay, startOfDay } from "@/lib/format";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

interface MiniCalendarProps {
  value: Date;
  onChange: (day: Date) => void;
  /** Days before this are disabled (e.g. can't schedule in the past). */
  minDate?: Date;
}

export function MiniCalendar({ value, onChange, minDate }: MiniCalendarProps) {
  const [month, setMonth] = useState(new Date(value.getFullYear(), value.getMonth(), 1));
  const today = new Date();

  // 6 rows x 7 days starting from the Sunday on/before the 1st.
  const gridStart = new Date(month.getFullYear(), month.getMonth(), 1 - month.getDay());
  const days = Array.from(
    { length: 42 },
    (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i),
  );
  const shiftMonth = (delta: number) =>
    setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));

  return (
    <div className="w-64 px-3 py-2">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">
          {month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </span>
        <div className="flex">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => shiftMonth(-1)}
            className="rounded p-1 hover:bg-shell"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
            className="rounded p-1 hover:bg-shell"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-xs">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="py-1 text-ink-3">
            {d}
          </span>
        ))}
        {days.map((day) => {
          const disabled = minDate !== undefined && day < startOfDay(minDate);
          const selected = isSameDay(day, value);
          return (
            <button
              key={day.toISOString()}
              type="button"
              disabled={disabled}
              onClick={() => onChange(day)}
              className={clsx(
                "mx-auto flex size-8 items-center justify-center rounded-full",
                day.getMonth() !== month.getMonth() && "text-ink-3/60",
                selected
                  ? "bg-zoom-blue text-white"
                  : isSameDay(day, today)
                    ? "font-semibold text-zoom-blue hover:bg-shell"
                    : "hover:bg-shell",
                disabled && "opacity-35 hover:bg-transparent",
              )}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
