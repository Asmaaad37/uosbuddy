import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="gutter mx-auto grid max-w-3xl gap-2 py-8 text-center text-[13px] text-ink-2">
      <p>
        UOSBuddy is a student-run project and is not an official University of Sargodha service.
      </p>
      <nav aria-label="Legal" className="flex justify-center gap-4">
        <Link href="/privacy" className="hover:text-ink">
          Privacy
        </Link>
        <Link href="/terms" className="hover:text-ink">
          Terms
        </Link>
        <Link href="/guidelines" className="hover:text-ink">
          Guidelines
        </Link>
        <Link href="/safety" className="hover:text-ink">
          Safety
        </Link>
      </nav>
    </footer>
  );
}
