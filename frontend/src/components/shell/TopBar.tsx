"use client";

import { Bell, ChevronLeft, ChevronRight, History, LogOut, Search, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { MenuItem, Popover } from "@/components/ui/Popover";
import { ZoomLogo } from "@/components/ui/ZoomLogo";
import { useMe } from "@/lib/queries";
import { toast } from "@/lib/toast";

export function TopBar() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K focuses search, like Zoom.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-line bg-white px-4">
      <Link href="/" className="flex items-center gap-3">
        <ZoomLogo className="h-[26px]" />
        <span className="hidden h-5 w-px bg-line sm:block" />
        <span className="hidden text-xl font-semibold tracking-tight text-ink sm:block">
          Workplace
        </span>
      </Link>

      <div className="flex flex-1 items-center justify-center gap-2">
        <div className="hidden items-center gap-1 text-ink-3 lg:flex">
          <IconButton label="Back" onClick={() => router.back()}>
            <ChevronLeft className="size-[18px]" />
          </IconButton>
          <IconButton label="Forward" onClick={() => router.forward()}>
            <ChevronRight className="size-[18px]" />
          </IconButton>
          <IconButton label="History" onClick={() => toast("Recent history is empty")}>
            <History className="size-4" />
          </IconButton>
        </div>
        <form
          className="relative hidden w-full max-w-[380px] md:block"
          onSubmit={(e) => {
            e.preventDefault();
            toast("Search isn't available in this demo");
          }}
        >
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-2" />
          <input
            ref={searchRef}
            aria-label="Search"
            placeholder="Search ⌘ + K"
            className="h-8 w-full rounded-md bg-field pr-3 pl-9 text-center text-sm text-ink placeholder:text-ink-2 focus:bg-white focus:text-left focus:outline-2 focus:outline-zoom-blue"
          />
        </form>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="hidden rounded-md px-2 py-1.5 text-sm text-ink-2 hover:bg-shell lg:block"
          onClick={() => toast("Admin Center isn't available in this demo")}
        >
          Admin Center
        </button>
        <button
          type="button"
          className="hidden rounded-full bg-zoom-blue-soft px-3.5 py-1.5 text-sm text-zoom-blue hover:bg-[#d3ddef] sm:block"
          onClick={() => toast("The desktop app download isn't part of this demo")}
        >
          Download
        </button>
        <IconButton label="Notifications" onClick={() => toast("No new notifications")}>
          <Bell className="size-[18px] text-ink-2" />
        </IconButton>
        <ProfileMenu />
      </div>
    </header>
  );
}

function ProfileMenu() {
  const router = useRouter();
  const { data } = useMe();
  const [open, setOpen] = useState(false);
  const user = data?.user;

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      align="right"
      className="w-64"
      anchor={
        <button type="button" aria-label="Profile" onClick={() => setOpen((o) => !o)}>
          <Avatar
            name={user?.name ?? ""}
            color={user?.avatar_color}
            size={32}
            presence="available"
          />
        </button>
      }
    >
      {user && (
        <>
          <div className="flex items-center gap-3 border-b border-line px-4 pt-2 pb-3">
            <Avatar name={user.name} color={user.avatar_color} size={40} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-ink-3">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 text-sm">
            <span className="size-2 rounded-full bg-green-500" /> Available
          </div>
          <MenuItem
            onClick={() => {
              setOpen(false);
              router.push("/settings");
            }}
          >
            <Settings className="size-4 text-ink-3" /> Settings
          </MenuItem>
          <MenuItem onClick={() => toast("Sign out arrives with login (Phase 8)")}>
            <LogOut className="size-4 text-ink-3" /> Sign out
          </MenuItem>
        </>
      )}
    </Popover>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-md hover:bg-shell"
    >
      {children}
    </button>
  );
}
