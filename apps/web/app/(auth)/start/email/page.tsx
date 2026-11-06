import type { Metadata } from "next";
import Link from "next/link";
import { Mail, UserPlus } from "lucide-react";
import { OnboardingShell } from "@/components/onboarding/shell";

export const metadata: Metadata = { title: "Your student email" };

const choices = [
  {
    href: "/start/uni-email",
    icon: Mail,
    title: "Yes, I have it",
    body: "Verify in seconds with your @uos.edu.pk email.",
  },
  {
    href: "/start/freshman",
    icon: UserPlus,
    title: "No, I'm a fresher / don't have it yet",
    body: "Join with your roll number and a photo of your student card or admission letter.",
  },
];

/** Email fork (Section 7, screen 3). */
export default function EmailForkPage() {
  return (
    <OnboardingShell back="/start/campus" step={2} title="Do you have your UoS student email?">
      <ul className="grid gap-3">
        {choices.map(({ href, icon: Icon, title, body }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex items-start gap-4 rounded-card border border-sep bg-surface p-4 shadow-card transition hover:border-accent hover:shadow-lift focus-visible:ring-3 focus-visible:ring-accent/25 focus-visible:outline-none"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-field bg-raised text-accent">
                <Icon className="size-5" />
              </span>
              <span className="grid gap-1">
                <span className="font-bold">{title}</span>
                <span className="text-sm text-sec">{body}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </OnboardingShell>
  );
}
