import Link from "next/link";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Dashboard", admin: true },
  { href: "/admin/reports", label: "Reports", admin: false },
  { href: "/admin/verifications", label: "Verifications", admin: true },
  { href: "/admin/studies", label: "Studies changes", admin: true },
  { href: "/admin/users", label: "People", admin: true },
  { href: "/admin/campus", label: "Campus", admin: true },
  { href: "/admin/catalogue", label: "Catalogue", admin: true },
  { href: "/admin/flags", label: "Flags", admin: true },
  { href: "/admin/launch", label: "Launch check", admin: true },
];

/** Phase 9: the admin area's frame. Moderators see only the reports queue. */
export function AdminShell({
  current,
  isAdmin,
  back,
  children,
}: {
  current: string;
  isAdmin: boolean;
  back: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <header className="gutter grid gap-2 border-b border-sep py-3">
        <div className="flex items-center justify-between">
          <span className="text-headline">UOSBUDDY {isAdmin ? "ADMIN" : "MODERATION"}</span>
          <Link href={back} className="text-sm font-semibold text-accent">
            Back to app
          </Link>
        </div>
        <nav aria-label="Admin" className="-mx-4 flex gap-1.5 overflow-x-auto px-4">
          {NAV.filter((n) => isAdmin || !n.admin).map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={current === n.href ? "page" : undefined}
              className={cn(
                "flex h-9 shrink-0 items-center rounded-pill px-3.5 text-sm font-semibold",
                current === n.href ? "bg-fill text-on-fill" : "hover:bg-raised",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="gutter mx-auto grid max-w-5xl gap-6 py-6">{children}</main>
    </div>
  );
}
