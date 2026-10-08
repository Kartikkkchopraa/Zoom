"use client";

import clsx from "clsx";
import { ChevronUp } from "lucide-react";

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  /** Shows the small ^ next to the icon; clicking it opens `menu`. */
  onCaret?: () => void;
  badge?: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}

/** A Zoom toolbar control: outline icon over a small label, optional ^ menu. */
export function ToolbarButton({
  icon,
  label,
  onClick,
  onCaret,
  badge,
  active,
  disabled,
  className,
}: ToolbarButtonProps) {
  return (
    <div className={clsx("relative flex items-start", className)}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={clsx(
          "flex min-w-[52px] flex-col items-center gap-1 rounded-md px-1 pt-1.5 pb-1 text-[11px] hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent sm:min-w-[60px] sm:px-2 sm:text-[12px]",
          active ? "text-[#5c8dff]" : "text-[#e1e1e3]",
        )}
      >
        <span className="relative flex h-[26px] items-center justify-center">
          {icon}
          {badge !== undefined && (
            <span className="absolute -top-1.5 -right-2.5 text-[10px] leading-none text-white">{badge}</span>
          )}
        </span>
        <span className="whitespace-nowrap">{label}</span>
      </button>
      {onCaret && (
        <button
          type="button"
          aria-label={`${label} options`}
          onClick={onCaret}
          className="mt-1 -ml-2 hidden rounded p-0.5 text-[#e1e1e3] hover:bg-white/10 md:block"
        >
          <ChevronUp className="size-3.5" />
        </button>
      )}
    </div>
  );
}
