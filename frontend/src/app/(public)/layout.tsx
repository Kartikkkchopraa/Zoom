import Link from "next/link";

import { ZoomLogo } from "@/components/ui/ZoomLogo";

/** Minimal zoom.us chrome used by the invite-link and sign-in pages (no Workplace shell). */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="flex h-16 items-center justify-between border-b border-line px-6 md:px-16">
        <Link href="/" aria-label="Zoom home">
          <ZoomLogo className="h-[30px]" />
        </Link>
        <span className="text-xs text-zoom-blue">English</span>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
