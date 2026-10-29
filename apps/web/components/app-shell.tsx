import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";

/** Frame for signed-in pages until the bottom nav arrives (Phase 3): back link, content. */
export function AppShell({
  back,
  backLabel = "Back",
  action,
  children,
}: {
  back?: string;
  backLabel?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-dotted flex min-h-dvh flex-col">
      <header className="gutter mx-auto flex w-full max-w-md items-center justify-between py-4">
        {back ? (
          <Link
            href={back}
            aria-label={backLabel}
            className="-ml-2 grid size-11 place-items-center rounded-pill text-ink hover:bg-surface-2"
          >
            <ArrowLeft className="size-5" />
          </Link>
        ) : (
          <span className="size-11" />
        )}
        {action ?? <span className="size-11" />}
      </header>
      <main className="gutter mx-auto flex w-full max-w-md flex-1 flex-col gap-6 pt-2 pb-8">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
