"use client";

import { Video } from "lucide-react";

/** "Do you want people to see you in the meeting?" — shown before asking for devices. */
export function PermissionPrompt({ onAllow, onSkip, error }: { onAllow: () => void; onSkip: () => void; error?: string | null }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
      <div className="w-full max-w-[516px] rounded-lg border border-[#2c2d2f] bg-room-tile px-6 pt-11 pb-11 text-center text-white">
        <Illustration />
        <h2 className="mt-9 text-base font-semibold">Do you want people to see you in the meeting?</h2>
        <p className="mt-1 text-sm text-room-text-2">
          You can still turn off your microphone and camera anytime in the meeting
        </p>
        {error && <p className="mt-3 text-sm text-[#ff6b6b]">{error}</p>}
        <button
          type="button"
          onClick={onAllow}
          className="mt-4 inline-flex h-8 items-center gap-2 rounded-md bg-zoom-blue px-4 text-sm hover:bg-zoom-blue-hover"
        >
          <Video className="size-4" /> Use microphone and camera
        </button>
        <div>
          <button type="button" onClick={onSkip} className="mt-3 text-sm text-[#7aa2ff] hover:underline">
            Continue without microphone and camera
          </button>
        </div>
      </div>
    </div>
  );
}

/** Person-at-a-desk illustration from Zoom's prompt, simplified. */
function Illustration() {
  return (
    <svg viewBox="0 0 178 156" className="mx-auto h-[156px] w-[178px]" aria-hidden>
      <rect width="178" height="156" rx="10" fill="#e9ecf6" />
      <ellipse cx="80" cy="118" rx="70" ry="26" fill="#f6f7fb" />
      <rect x="36" y="38" width="30" height="24" rx="5" fill="#5b7cf6" />
      <path d="M44 46h10v8H44zM54 50l6-3v6z" fill="none" stroke="#fff" strokeWidth="1.6" />
      <rect x="76" y="30" width="22" height="22" rx="5" fill="#6d4ee6" />
      <rect x="84" y="35" width="6" height="9" rx="3" fill="#fff" />
      <rect x="116" y="28" width="48" height="40" rx="2" fill="#2b2f3a" />
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => (
          <rect
            key={`${r}${c}`}
            x={118 + c * 15.5}
            y={30 + r * 12.5}
            width="14"
            height="11"
            fill={["#f7c46c", "#f29a76", "#8fd3c1", "#c6a3f2", "#f7c46c", "#89b4f7", "#f29a76", "#8fd3c1", "#f7c46c"][r * 3 + c]}
          />
        )),
      )}
      <path d="M46 92h110" stroke="#2b2f3a" strokeWidth="2.5" />
      <path d="M56 92l-6 44M146 92l6 44M120 92v40" stroke="#2b2f3a" strokeWidth="1.6" />
      <circle cx="98" cy="62" r="7" fill="#2b2f3a" />
      <path d="M90 72q8-4 16 0l4 20H86z" fill="#f2a64b" />
      <path d="M92 92l-4 26 6 2M104 92l10 22 4 6" fill="none" stroke="#2b2f3a" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
