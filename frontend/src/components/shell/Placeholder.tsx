import type { LucideIcon } from "lucide-react";

/** Empty state for Workplace tabs that are outside the assignment scope. */
export function Placeholder({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-shell text-ink-3">
        <Icon className="size-7" strokeWidth={1.5} />
      </span>
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="max-w-sm text-sm text-ink-3">{body}</p>
    </div>
  );
}
