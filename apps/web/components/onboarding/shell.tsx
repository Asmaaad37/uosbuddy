import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { SiteFooter } from "@/components/site-footer";

/** Frame for the sign-up screens (Section 7, screens 2–5): back link, step dots, title. */
export function OnboardingShell({
  back,
  step,
  steps = 4,
  title,
  subtitle,
  children,
}: {
  back?: string;
  step?: number;
  steps?: number;
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-dotted flex min-h-dvh flex-col">
      <header className="gutter mx-auto flex w-full max-w-md items-center justify-between py-4">
        {back ? (
          <Link
            href={back}
            aria-label="Back"
            className="-ml-2 grid size-11 place-items-center rounded-pill text-ink hover:bg-surface-2"
          >
            <ArrowLeft className="size-5" />
          </Link>
        ) : (
          <span className="size-11" />
        )}
        {step && (
          <ol aria-label={`Step ${step} of ${steps}`} className="flex gap-1.5">
            {Array.from({ length: steps }, (_, i) => (
              <li
                key={i}
                className={cn(
                  "h-2 rounded-pill transition-all",
                  i + 1 === step ? "w-6 bg-brand" : "w-2",
                  i + 1 < step ? "bg-ink" : i + 1 > step && "bg-line",
                )}
              />
            ))}
          </ol>
        )}
        <span className="size-11" />
      </header>
      <main className="gutter mx-auto flex w-full max-w-md flex-1 flex-col gap-6 pt-2 pb-8">
        <div className="grid gap-2">
          <h1 className="text-[28px] leading-tight font-bold">{title}</h1>
          {subtitle && <p className="text-ink-2">{subtitle}</p>}
        </div>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
