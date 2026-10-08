import { AuthGuard } from "@/components/shell/AuthGuard";
import { LeftRail } from "@/components/shell/LeftRail";
import { TopBar } from "@/components/shell/TopBar";

/** The Zoom Workplace frame: top bar + left rail around a white content card. */
export default function WorkplaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <LeftRail />
        <main className="mb-16 min-w-0 flex-1 overflow-y-auto bg-white md:mt-1 md:mr-1.5 md:mb-1.5 md:rounded-xl">
          <AuthGuard>{children}</AuthGuard>
        </main>
      </div>
    </div>
  );
}
