"use client";

import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { ChevronLeft, Mic, MicOff, SquareUserRound, Video, VideoOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";

import { DeviceList } from "@/components/room/Toolbar";
import { ToolbarButton } from "@/components/room/ToolbarButton";
import { Popover } from "@/components/ui/Popover";
import { api, ApiError } from "@/lib/api";
import { DEVICE_ERROR_MS } from "@/lib/meeting/actions";
import { useMedia } from "@/lib/meeting/media";
import { useMe } from "@/lib/queries";
import { useJoinSessions, useRememberedName } from "@/lib/session";
import { toast } from "@/lib/toast";
import { useGuestEntry } from "@/lib/useGuestEntry";

/**
 * Web-client join page ("Enter Meeting Info"): a camera preview with mic and
 * video toggles beside the name (and passcode, if the link has none) form.
 * The devices chosen here carry straight into the meeting room.
 */
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
  const media = useMedia();

  // The credential is the invite link when we have its pwd token, else the bare ID.
  const credential = pwd ? `/j/${code}?pwd=${encodeURIComponent(pwd)}` : code;
  const backHref = pwd ? credential : `/j/${code}`;

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
  const [remember, setRemember] = useState(!!remembered.name);
  const [micChoice, setMicChoice] = useState<boolean | null>(null);
  const [menu, setMenu] = useState<"audio" | "video" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const displayName = name ?? remembered.name ?? me?.user.name ?? "";
  // Zoom's preview starts with the mic live; signed-in users follow their setting.
  const micOn = micChoice ?? !me?.settings.mute_mic_on_join;
  const camOn = !!media.videoTrack;

  // Leaving without joining (Back, closing the tab) turns the camera off again.
  const joiningRef = useRef(false);
  useEffect(
    () => () => {
      if (!joiningRef.current) useMedia.getState().stopAll();
    },
    [],
  );

  function toggleMic() {
    setMicChoice(!micOn);
    media.setMicMuted(micOn);
  }

  function toggleCamera() {
    if (camOn) media.stopCamera();
    else void media.startCamera();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const room = await api.joinCheck(credential, needsPasscode ? passcode : undefined);
      // Join with audio, like Zoom; "Mute participants upon entry" still applies.
      const devices = useMedia.getState();
      if (!devices.audioTrack) await devices.connectAudio();
      useMedia.getState().setMicMuted(!micOn || room.mute_on_entry);
      const deviceError = useMedia.getState().error;
      if (deviceError) toast(deviceError, "error", DEVICE_ERROR_MS);

      remembered.setName(remember ? displayName.trim() : null);
      saveSession(code, {
        displayName: displayName.trim(),
        credential,
        passcode: needsPasscode ? passcode : undefined,
        joinAudio: true,
        videoOn: !!useMedia.getState().videoTrack,
        asHost: false,
      });
      joiningRef.current = true;
      router.push(`/wc/${code}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to join. Please try again.");
      setBusy(false);
    }
  }

  const loading = !guestReady || check.isPending;
  const canJoin = !busy && !!displayName.trim() && !(needsPasscode && !passcode);
  const menuProps = { tone: "dark" as const, side: "top" as const, onClose: () => setMenu(null), className: "w-72" };

  return (
    // Full-screen dark page over the public header, like Zoom's web client.
    <div className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-[#1e1f22] text-white">
      <Link href={backHref} className="flex w-fit items-center gap-1 px-6 pt-8 text-sm text-[#5c8dff] hover:underline md:px-10">
        <ChevronLeft className="size-4" /> Back
      </Link>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-8 md:flex-row md:gap-10">
        {/* Preview */}
        <div className="relative aspect-[4/3] w-full max-w-[700px] sm:aspect-video overflow-hidden rounded-xl bg-[#323336]">
          {camOn ? (
            <SelfPreview track={media.videoTrack!} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <PersonPlaceholder />
            </div>
          )}

          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-lg bg-black/90 px-1.5">
            <Popover
              {...menuProps}
              open={menu === "audio"}
              anchor={
                <ToolbarButton
                  icon={
                    micOn ? (
                      <Mic className="size-[22px]" strokeWidth={1.5} />
                    ) : (
                      <MicOff className="size-[22px] text-[#ff4d4f]" strokeWidth={1.5} />
                    )
                  }
                  label={micOn ? "Mute" : "Unmute"}
                  onClick={toggleMic}
                  onCaret={() => setMenu(menu === "audio" ? null : "audio")}
                />
              }
            >
              <DeviceMenu
                empty="Your microphone is chosen when you join"
                lists={[
                  { title: "Select a Microphone", devices: media.devices.mics, selected: media.micId, onSelect: media.selectMic },
                  {
                    title: "Select a Speaker",
                    devices: media.devices.speakers,
                    selected: media.speakerId,
                    onSelect: async (id) => media.selectSpeaker(id),
                  },
                ]}
                onDone={() => setMenu(null)}
              />
            </Popover>
            <Popover
              {...menuProps}
              open={menu === "video"}
              anchor={
                <ToolbarButton
                  icon={
                    camOn ? (
                      <Video className="size-[22px]" strokeWidth={1.5} />
                    ) : (
                      <VideoOff className="size-[22px] text-[#ff4d4f]" strokeWidth={1.5} />
                    )
                  }
                  label={camOn ? "Stop Video" : "Start Video"}
                  onClick={toggleCamera}
                  onCaret={() => setMenu(menu === "video" ? null : "video")}
                />
              }
            >
              <DeviceMenu
                empty="Start your video to choose a camera"
                lists={[{ title: "Select a Camera", devices: media.devices.cams, selected: media.camId, onSelect: media.selectCamera }]}
                onDone={() => setMenu(null)}
              />
            </Popover>
          </div>

          <button
            type="button"
            onClick={() => toast("Virtual backgrounds aren't available in this demo")}
            className="absolute right-3 bottom-3 hidden items-center gap-1.5 rounded-md bg-black/90 px-3 py-1.5 text-xs hover:bg-black sm:flex"
          >
            <SquareUserRound className="size-4" /> Backgrounds
          </button>

          {media.error && (
            <p role="alert" className="absolute inset-x-0 top-0 bg-black/70 px-4 py-2 text-center text-xs text-[#ff8a8a]">
              {media.error}
            </p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={submit} className="flex w-full max-w-[400px] flex-col gap-3">
          <h1 className="mb-1 text-center text-2xl font-semibold">Enter Meeting Info</h1>

          {loading && <div className="h-36 animate-pulse rounded-lg bg-white/5" />}

          {fatal && (
            <div role="alert" className="rounded-lg bg-[#3a1f22] px-4 py-3 text-center text-sm text-[#ff8a8a]">
              {check.error instanceof ApiError ? check.error.message : "Unable to load this meeting"}
            </div>
          )}

          {(check.isSuccess || needsPasscode) && (
            <>
              {check.data && <p className="-mt-2 mb-1 text-center text-sm text-[#a8abb2]">{check.data.title}</p>}
              {needsPasscode && (
                <DarkField label="Meeting Passcode">
                  <input
                    autoFocus
                    type="password"
                    required
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    className={inputClass}
                  />
                </DarkField>
              )}
              <DarkField label="Your Name">
                <input
                  autoFocus={!needsPasscode}
                  required
                  maxLength={100}
                  value={displayName}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                />
              </DarkField>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="size-4 accent-zoom-blue"
                />
                Remember my name for future meetings
              </label>
              {error && (
                <p role="alert" className="text-sm text-[#ff8a8a]">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={!canJoin}
                className={clsx(
                  "mt-2 h-10 rounded-lg text-base font-semibold",
                  canJoin ? "bg-zoom-blue hover:bg-zoom-blue-hover" : "bg-[#2e2f32] text-[#8b8d92]",
                )}
              >
                {busy ? "Joining…" : "Join"}
              </button>
              <p className="mt-3 text-sm text-[#c4c6cb]">
                By clicking &quot;Join&quot;, you agree to our <span className="text-[#5c8dff]">Terms of Service</span> and{" "}
                <span className="text-[#5c8dff]">Privacy Statement</span>.
              </p>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

const inputClass =
  "h-10 w-full rounded-lg border-2 border-[#5f6166] bg-transparent px-3 text-[15px] text-white outline-none focus:border-[#5c8dff]";

function DarkField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2 text-sm font-semibold">
      {label}
      {children}
    </label>
  );
}

/** Zoom's grey "no video" person card. */
function PersonPlaceholder() {
  return (
    <svg viewBox="0 0 175 150" className="w-[25%] max-w-[175px] min-w-[96px]" aria-hidden>
      <rect width="175" height="150" rx="22" fill="#4a4b4e" />
      <circle cx="87.5" cy="60" r="27" fill="#2b2c2f" />
      <path d="M37 137c0-26 22.6-42 50.5-42s50.5 16 50.5 42z" fill="#2b2c2f" />
    </svg>
  );
}

/** Self view, mirrored like Zoom's. */
function SelfPreview({ track }: { track: MediaStreamTrack }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = new MediaStream([track]);
  }, [track]);
  return <video ref={ref} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" />;
}

interface DeviceGroup {
  title: string;
  devices: MediaDeviceInfo[];
  selected: string | null;
  onSelect: (deviceId: string) => Promise<void>;
}

/** Device pickers under the ^ carets; devices are only listed once access is granted. */
function DeviceMenu({ lists, empty, onDone }: { lists: DeviceGroup[]; empty: string; onDone: () => void }) {
  if (lists.every((l) => !l.devices.length)) return <p className="px-4 py-2 text-sm text-[#a8abb2]">{empty}</p>;
  return (
    <>
      {lists.map((l) => (
        <DeviceList
          key={l.title}
          title={l.title}
          devices={l.devices}
          selected={l.selected}
          onSelect={(id) => void l.onSelect(id).then(onDone)}
        />
      ))}
    </>
  );
}
