"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { use, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Checkbox, Input } from "@/components/ui/Form";
import { api, ApiError } from "@/lib/api";
import { useMe } from "@/lib/queries";
import { useJoinSessions, useRememberedName } from "@/lib/session";
import { useGuestEntry } from "@/lib/useGuestEntry";

/** Web-client join page: display name (and passcode if the link has none). */
export default function BrowserJoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ pwd?: string }>;
}) {
  const { code } = use(params);
  const { pwd } = use(searchParams);
  const router = useRouter();
  const guestReady = useGuestEntry();
  const { data: me } = useMe({ enabled: guestReady });
  const remembered = useRememberedName();
  const saveSession = useJoinSessions((s) => s.save);

  // The credential is the invite link when we have its pwd token, else the bare ID.
  const credential = pwd ? `/j/${code}?pwd=${encodeURIComponent(pwd)}` : code;

  // Validate up front so a bad link fails before the user types anything.
  const check = useQuery({
    queryKey: ["join-check", credential],
    queryFn: () => api.joinCheck(credential),
    enabled: guestReady,
    retry: false,
  });
  const errorCode = check.error instanceof ApiError ? check.error.code : null;
  const needsPasscode = errorCode === "passcode_required";
  const fatal = check.error && !needsPasscode;

  const [name, setName] = useState<string | null>(null);
  const [passcode, setPasscode] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const displayName = name ?? remembered.name ?? me?.user.name ?? "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.joinCheck(credential, needsPasscode ? passcode : undefined);
      remembered.setName(remember ? displayName.trim() : null);
      saveSession(code, {
        displayName: displayName.trim(),
        credential,
        passcode: needsPasscode ? passcode : undefined,
        joinAudio: true,
        videoOn: !me?.settings.video_off_on_join,
        asHost: false,
      });
      router.push(`/wc/${code}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to join. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center px-4 pt-20 pb-16">
      <form onSubmit={submit} className="flex w-full max-w-[400px] flex-col gap-5">
        <h1 className="text-center text-2xl font-semibold">Join Meeting</h1>

        {(!guestReady || check.isPending) && <div className="h-40 animate-pulse rounded-lg bg-shell" />}

        {fatal && (
          <div role="alert" className="rounded-lg border border-zoom-red/30 bg-[#fdf1f1] px-4 py-3 text-center text-sm text-zoom-red">
            {check.error instanceof ApiError ? check.error.message : "Unable to load this meeting"}
          </div>
        )}

        {(check.isSuccess || needsPasscode) && (
          <>
            {check.data && <p className="text-center text-sm text-ink-2">{check.data.title}</p>}
            {needsPasscode && (
              <label className="flex flex-col gap-1.5 text-sm">
                Meeting Passcode
                <Input
                  autoFocus
                  type="password"
                  required
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="h-10"
                />
              </label>
            )}
            <label className="flex flex-col gap-1.5 text-sm">
              Your Name
              <Input
                autoFocus={!needsPasscode}
                required
                maxLength={100}
                value={displayName}
                onChange={(e) => setName(e.target.value)}
                className="h-10"
              />
            </label>
            <Checkbox
              label="Remember my name for future meetings"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            {error && (
              <p role="alert" className="text-sm text-zoom-red">
                {error}
              </p>
            )}
            <Button
              type="submit"
              size="lg"
              className="h-11 rounded-md font-normal"
              disabled={busy || !displayName.trim() || (needsPasscode && !passcode)}
            >
              Join
            </Button>
          </>
        )}
      </form>
    </div>
  );
}
