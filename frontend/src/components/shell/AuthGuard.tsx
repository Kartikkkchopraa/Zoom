"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { isUnauthenticated } from "@/lib/api";
import { useMe } from "@/lib/queries";

/**
 * Sends signed-out visitors to Sign In. Meeting rooms (/wc/...) stay open to
 * guests who joined by link, so they're exempt.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { error } = useMe();
  const signedOut = isUnauthenticated(error);
  const guestAllowed = pathname.startsWith("/wc/");

  useEffect(() => {
    if (signedOut && !guestAllowed) router.replace(`/signin?next=${encodeURIComponent(pathname)}`);
  }, [signedOut, guestAllowed, pathname, router]);

  return signedOut && !guestAllowed ? null : children;
}

/** Only allow same-site relative redirects after sign-in (no open redirects). */
export function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
