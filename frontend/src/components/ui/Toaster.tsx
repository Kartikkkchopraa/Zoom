"use client";

import { CheckCircle2, Info, XCircle } from "lucide-react";

import { useToasts } from "@/lib/toast";

const ICONS = {
  info: <Info className="size-4 text-zoom-blue" />,
  success: <CheckCircle2 className="size-4 text-green-600" />,
  error: <XCircle className="size-4 text-zoom-red" />,
};

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-[100] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm text-ink shadow-lg"
        >
          {ICONS[t.tone]}
          {t.message}
        </div>
      ))}
    </div>
  );
}
