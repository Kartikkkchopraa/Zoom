"use client";

import { Eye, EyeOff, KeyRound } from "lucide-react";
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

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6 text-black" fill="currentColor" aria-hidden>
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="#0866FF" aria-hidden>
      <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />
    </svg>
  );
}

const PROVIDERS: { name: string; icon: React.ReactNode }[] = [
  { name: "SSO", icon: <KeyRound className="size-6 text-ink" strokeWidth={1.8} /> },
  { name: "Apple", icon: <AppleIcon /> },
  { name: "Google", icon: <GoogleIcon /> },
  { name: "Facebook", icon: <FacebookIcon /> },
];

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
        {PROVIDERS.map(({ name, icon }) => (
          <button
            key={name}
            type="button"
            onClick={() => toast(`${name} sign-in isn't available in this demo`)}
            className="flex size-16 flex-col items-center justify-center gap-1.5 rounded-xl border border-line text-[11px] text-ink-2 hover:bg-shell"
          >
            {icon}
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}
