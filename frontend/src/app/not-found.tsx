import Link from "next/link";

import { ZoomLogo } from "@/components/ui/ZoomLogo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-white px-6 text-center">
      <ZoomLogo className="h-8" />
      <h1 className="mt-4 text-2xl font-semibold">Page not found</h1>
      <p className="max-w-sm text-sm text-ink-2">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
      <Link href="/" className="mt-2 rounded-lg bg-zoom-blue px-5 py-2 text-sm font-semibold text-white hover:bg-zoom-blue-hover">
        Back to Home
      </Link>
    </div>
  );
}
