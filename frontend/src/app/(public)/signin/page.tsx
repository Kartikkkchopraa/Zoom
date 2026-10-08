"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { AuthCard, Field, PasswordField, SocialSignIn } from "@/components/auth/AuthCard";
import { safeNext } from "@/components/shell/AuthGuard";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Form";
import { api, ApiError } from "@/lib/api";
import { queryKeys } from "@/lib/queries";
import { toast } from "@/lib/toast";

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me = await api.login(email, password);
      // Drop the previous account's cached data before showing the new one.
      queryClient.clear();
      queryClient.setQueryData(queryKeys.me, me);
      router.replace(safeNext(params.get("next")));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't sign in. Please try again.");
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Sign in">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field
          label="Email Address"
          type="email"
          autoComplete="email"
          autoFocus
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm text-zoom-red">
            {error}
          </p>
        )}
        <div className="flex items-center justify-between text-sm">
          <Checkbox label="Stay signed in" defaultChecked />
          <button
            type="button"
            className="text-zoom-blue hover:underline"
            onClick={() => toast("Password reset isn't available in this demo")}
          >
            Forgot password?
          </button>
        </div>
        <Button type="submit" size="lg" className="mt-2 h-11" disabled={busy}>
          {busy ? "Signing in…" : "Sign In"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-2">
        New to Zoom?{" "}
        <Link href={`/signup${params.get("next") ? `?next=${encodeURIComponent(params.get("next")!)}` : ""}`} className="text-zoom-blue hover:underline">
          Sign Up Free
        </Link>
      </p>

      <SocialSignIn verb="sign in" />

      <div className="mt-8 rounded-lg border border-[#afcaf6] bg-[#f3f8ff] px-4 py-3 text-xs text-ink-2">
        <p className="font-semibold text-ink">Demo account</p>
        <p>aryan@zoomclone.dev / password123 (other seeded users use the same password)</p>
      </div>
    </AuthCard>
  );
}
