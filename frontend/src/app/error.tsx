"use client";

import { useEffect } from "react";

import { ZoomLogo } from "@/components/ui/ZoomLogo";

/** Last-resort boundary for unexpected render errors. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-white px-6 text-center">
      <ZoomLogo className="h-8" />
      <h1 className="mt-4 text-2xl font-semibold">Something went wrong</h1>
      <p className="max-w-sm text-sm text-ink-2">Please try again. If the problem continues, reload the page.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 rounded-lg bg-zoom-blue px-5 py-2 text-sm font-semibold text-white hover:bg-zoom-blue-hover"
      >
        Try again
      </button>
    </div>
  );
}
