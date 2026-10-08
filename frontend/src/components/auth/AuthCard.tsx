"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { Input } from "@/components/ui/Form";
import { toast } from "@/lib/toast";

/** Centered card shared by Sign In and Sign Up (zoom.us style). */
export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-start justify-center px-4 pt-16 pb-16">
      <div className="w-full max-w-[400px]">
        <h1 className="mb-8 text-center text-[28px] font-semibold text-ink">{title}</h1>
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5 text-sm text-ink">
      {label}
      <Input className="h-11 rounded-lg" {...props} />
    </label>
  );
}

export function PasswordField({
  label,
  ...props
}: { label: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="flex flex-col gap-1.5 text-sm text-ink">
      {label}
      <span className="relative">
        <Input type={visible ? "text" : "password"} className="h-11 rounded-lg pr-10" {...props} />
        <button
          type="button"
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((v) => !v)}
          className="absolute top-1/2 right-3 -translate-y-1/2 text-ink-3 hover:text-ink"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </span>
    </label>
  );
}

const PROVIDERS = ["SSO", "Apple", "Google", "Facebook"];

/** "or sign in with" row — third-party sign-in is outside this clone's scope. */
export function SocialSignIn({ verb }: { verb: string }) {
  return (
    <div className="mt-8">
      <div className="flex items-center gap-3 text-xs text-ink-3">
        <span className="h-px flex-1 bg-line" />
        or {verb} with
        <span className="h-px flex-1 bg-line" />
      </div>
      <div className="mt-4 flex justify-center gap-4">
        {PROVIDERS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => toast(`${p} sign-in isn't available in this demo`)}
            className="flex size-14 flex-col items-center justify-center rounded-xl border border-line text-[11px] text-ink-2 hover:bg-shell"
          >
            <span className="text-base font-semibold text-ink">{p[0]}</span>
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
