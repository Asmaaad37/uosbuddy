import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { BellSlot } from "@/components/notifications/bell-slot";
import { cn } from "@/lib/utils";

/**
 * Page frame for signed-in screens (redesign §3–4): a 44px toolbar (back on the left,
 * round icon buttons on the right) below the safe area, then the content: full width with
 * 16px gutters on phones, 560px on tablets, 600px beside the desktop sidebar. Screens
 * rebuilt for the redesign use ScreenHeader for their large title.
 */
export function AppShell({
  back,
  backLabel = "Back",
  action,
  bell = false,
  children,
}: {
  back?: string;
  backLabel?: string;
  action?: React.ReactNode;
  /** Show the notification bell (top-level pages; the desktop sidebar has its own). */
  bell?: boolean;
  children: React.ReactNode;
}) {
  // Screens rebuilt for the redesign bring a ScreenHeader (toolbar + large title) instead.
  const toolbar = !!(back || action || bell);
  return (
    <div className={cn("flex min-h-dvh flex-col", toolbar && "pt-[env(safe-area-inset-top)]")}>
      {toolbar && (
        <header className="mx-auto flex h-11 w-full max-w-[560px] items-center justify-between gap-2 px-4 lg:max-w-[600px]">
          {back ? (
            <Link
              href={back}
              aria-label={backLabel}
              className="-ml-2 grid size-11 place-items-center rounded-pill text-accent transition-transform duration-100 ease-out active:scale-[0.97]"
            >
              <ChevronLeft className="size-7" aria-hidden />
            </Link>
          ) : (
            <span className="size-11" />
          )}
          <span className="flex items-center gap-2">
            {bell && (
              <span className="lg:hidden">
                <BellSlot />
              </span>
            )}
            {action}
          </span>
        </header>
      )}
      <main
        className={cn(
          "mx-auto flex w-full max-w-[560px] flex-1 flex-col gap-6 px-4 pb-8 lg:max-w-[600px]",
          toolbar && "pt-1.5",
        )}
      >
        {children}
      </main>
    </div>
  );
}
