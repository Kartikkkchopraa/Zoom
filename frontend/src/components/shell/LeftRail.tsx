"use client";

import clsx from "clsx";
import { Contact, House, MessagesSquare, Settings, Video, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const MAIN: NavItem[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/chat", label: "Chat", icon: MessagesSquare },
  { href: "/meetings", label: "Meetings", icon: Video },
  { href: "/contacts", label: "Contacts", icon: Contact },
];
const SETTINGS: NavItem = { href: "/settings", label: "Settings", icon: Settings };

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
}

function RailLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={clsx(
        "flex w-[72px] flex-col items-center gap-1 rounded-lg py-2 text-[11px] tracking-wide",
        active ? "bg-white text-ink shadow-[0_0_0_1px_rgba(0,0,0,0.02)]" : "text-ink-2 hover:bg-white/60",
      )}
    >
      <Icon className="size-[18px]" strokeWidth={1.6} />
      {item.label}
    </Link>
  );
}

/** Vertical navigation on desktop; becomes a bottom tab bar on small screens. */
export function LeftRail() {
  const isActive = useIsActive();
  return (
    <>
      <nav className="hidden w-20 shrink-0 flex-col items-center justify-between py-1 md:flex">
        <div className="flex flex-col gap-1">
          {MAIN.map((item) => (
            <RailLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </div>
        <RailLink item={SETTINGS} active={isActive(SETTINGS.href)} />
      </nav>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-line bg-white py-1 md:hidden">
        {[...MAIN, SETTINGS].map((item) => (
          <RailLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </nav>
    </>
  );
}
