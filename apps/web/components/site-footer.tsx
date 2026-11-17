import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="gutter mx-auto grid max-w-3xl gap-2 py-8 text-center text-footnote text-sec">
      <p>
        UOSBuddy is a student-run project and is not an official University of Sargodha service.
      </p>
      <nav aria-label="Legal" className="flex justify-center gap-4">
        <Link href="/privacy" className="hit hover:text-label">
          Privacy
        </Link>
        <Link href="/terms" className="hit hover:text-label">
          Terms
        </Link>
        <Link href="/guidelines" className="hit hover:text-label">
          Guidelines
        </Link>
        <Link href="/safety" className="hit hover:text-label">
          Safety
        </Link>
      </nav>
    </footer>
  );
}
