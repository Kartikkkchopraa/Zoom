"use client";

import { X } from "lucide-react";
import { useState } from "react";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Invitees field: type emails, Enter/comma/space turns them into removable chips. */
export function EmailChips({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (emails: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);

  function commit() {
    const email = draft.trim().replace(/[,;]$/, "").toLowerCase();
    if (!email) return;
    if (!EMAIL.test(email)) {
      setInvalid(true);
      return;
    }
    if (!value.includes(email)) onChange([...value, email]);
    setDraft("");
    setInvalid(false);
  }

  return (
    <div>
      <div className="flex min-h-8 flex-wrap items-center gap-1.5 rounded-lg border border-[#c5c9d0] bg-white px-2 py-1 focus-within:border-zoom-blue focus-within:ring-2 focus-within:ring-zoom-blue/25">
        {value.map((email) => (
          <span
            key={email}
            className="flex items-center gap-1 rounded-md bg-zoom-blue-soft py-0.5 pr-1 pl-2 text-xs text-ink"
          >
            {email}
            <button
              type="button"
              aria-label={`Remove ${email}`}
              onClick={() => onChange(value.filter((e) => e !== email))}
              className="rounded p-0.5 hover:bg-black/10"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          aria-label="Invitees"
          placeholder={value.length ? "" : placeholder}
          onChange={(e) => {
            setDraft(e.target.value);
            setInvalid(false);
          }}
          onKeyDown={(e) => {
            if (["Enter", ",", ";", " ", "Tab"].includes(e.key) && draft.trim()) {
              e.preventDefault();
              commit();
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={commit}
          className="h-6 min-w-40 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-ink-3"
        />
      </div>
      {invalid && <p className="mt-1 text-xs text-zoom-red">Enter a valid email address</p>}
    </div>
  );
}
