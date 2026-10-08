"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { AuthCard, Field, PasswordField, SocialSignIn } from "@/components/auth/AuthCard";
import { safeNext } from "@/components/shell/AuthGuard";
import { Button } from "@/components/ui/Button";
import { api, ApiError } from "@/lib/api";
import { queryKeys } from "@/lib/queries";

const MIN_PASSWORD = 8;

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}

function SignUpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) return setError(`Password must be at least ${MIN_PASSWORD} characters`);
    setBusy(true);
    setError(null);
    try {
      const me = await api.signup(name.trim(), email, password);
      queryClient.clear();
      queryClient.setQueryData(queryKeys.me, me);
      router.replace(safeNext(params.get("next")));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create your account. Please try again.");
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Create your account">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field
          label="Full Name"
          autoComplete="name"
          autoFocus
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Field
          label="Email Address"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordField
          label="Password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="-mt-2 text-xs text-ink-3">At least {MIN_PASSWORD} characters</p>
        {error && (
          <p role="alert" className="text-sm text-zoom-red">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="mt-2 h-11" disabled={busy}>
          {busy ? "Creating account…" : "Sign Up"}
        </Button>
        <p className="text-center text-xs text-ink-3">
          By signing up, you agree to the <span className="text-zoom-blue">Privacy Statement</span> and{" "}
          <span className="text-zoom-blue">Terms of Service</span>.
        </p>
      </form>

      <p className="mt-6 text-center text-sm text-ink-2">
        Already have an account?{" "}
        <Link href="/signin" className="text-zoom-blue hover:underline">
          Sign In
        </Link>
      </p>

      <SocialSignIn verb="sign up" />
    </AuthCard>
  );
}
