import { ChevronDown } from "lucide-react";
import Link from "next/link";

import { ZoomLogo } from "@/components/ui/ZoomLogo";

/** Minimal zoom.us chrome used by the invite-link pages (no Workplace shell). */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="flex h-16 items-center justify-between border-b border-line px-6 md:px-16">
        <Link href="/" aria-label="Zoom home">
          <ZoomLogo className="h-[30px]" />
        </Link>
        <nav className="flex items-center gap-6 text-xs text-zoom-blue">
          <span>Support</span>
          <span className="flex items-center gap-0.5">
            English <ChevronDown className="size-3" />
          </span>
        </nav>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
      <footer className="px-6 py-6 text-center text-sm text-ink-3">
        <p>©{new Date().getFullYear()} Zoom Clone. Built for a fullstack assignment.</p>
      </footer>
    </div>
  );
}
