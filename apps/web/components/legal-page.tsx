import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";

const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

/** How to reach us, or an honest note until a support address is configured. */
export function ContactLine() {
  return supportEmail ? (
    <>
      email{" "}
      <a href={`mailto:${supportEmail}`} className="font-semibold text-brand">
        {supportEmail}
      </a>
    </>
  ) : (
    <>contact us through the app (a support address will be listed here before launch)</>
  );
}

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="gutter mx-auto w-full max-w-2xl py-4">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold">
          <ArrowLeft className="size-4" /> UOSBuddy
        </Link>
      </header>
      <main className="gutter mx-auto w-full max-w-2xl flex-1 pb-12">
        <h1 className="text-[32px] leading-tight font-bold">{title}</h1>
        <p className="mt-2 text-sm text-ink-2">Last updated {updated}</p>
        <div className="mt-8 grid gap-6 leading-relaxed [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_section]:grid [&_section]:gap-3 [&_ul]:grid [&_ul]:gap-1.5">
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
