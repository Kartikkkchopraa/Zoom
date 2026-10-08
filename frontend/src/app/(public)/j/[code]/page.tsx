"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";

import { Button } from "@/components/ui/Button";

/** Invite-link landing page: "Join from Zoom Workplace app" / "Join from browser". */
export default function InviteLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ pwd?: string }>;
}) {
  const { code } = use(params);
  const { pwd } = use(searchParams);
  const [hintOpen, setHintOpen] = useState(true);
  const browserHref = `/wc/${code}/join${pwd ? `?pwd=${encodeURIComponent(pwd)}` : ""}`;

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 pb-24">
      <h1 className="mb-12 text-2xl font-semibold text-ink">Join meeting</h1>

      <div className="relative flex w-full max-w-[400px] flex-col gap-5">
        <Button size="lg" className="h-12 rounded-md font-normal" onClick={() => setHintOpen(true)}>
          Join from Zoom Workplace app
        </Button>
        <Link
          href={browserHref}
          className="flex h-12 items-center justify-center rounded-md border border-ink-3 text-[15px] text-ink hover:bg-shell"
        >
          Join from browser
        </Link>

        {hintOpen && (
          <div className="absolute top-[-20px] left-[calc(100%+12px)] hidden w-[360px] rounded-md bg-white p-3 text-sm shadow-[0_2px_12px_rgba(0,0,0,0.16)] lg:block">
            <button
              type="button"
              aria-label="Close"
              onClick={() => setHintOpen(false)}
              className="absolute top-2.5 right-2.5 rounded-full border-2 border-zoom-blue p-0.5 text-ink"
            >
              <X className="size-3" />
            </button>
            <p className="mb-1 text-base font-semibold">Did not open Zoom Workplace app?</p>
            <p className="text-ink">
              There is no desktop app for this clone. Click{" "}
              <Link href={browserHref} className="text-zoom-blue">
                Join from browser
              </Link>{" "}
              to continue.
            </p>
          </div>
        )}
      </div>

      <p className="mt-7 text-sm text-ink">
        Don&apos;t have the Zoom Workplace app installed?{" "}
        <Link href={browserHref} className="text-zoom-blue">
          Join from browser
        </Link>
      </p>
      <p className="mt-5 text-sm text-ink">
        By joining a meeting, you agree to our <span className="text-zoom-blue">Terms of Service</span> and{" "}
        <span className="text-zoom-blue">Privacy Statement</span>
      </p>
    </div>
  );
}
