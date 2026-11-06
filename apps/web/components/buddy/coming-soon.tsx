import Link from "next/link";
import { BookOpen, Quote, Sparkles } from "lucide-react";
import { AIBuddyMascot } from "@/components/buddy/ai-buddy-mascot";

const PREVIEW = [
  { icon: BookOpen, text: "Answers from your course's notes, past papers and outlines" },
  { icon: Quote, text: "Shows exactly which file and page each answer comes from" },
  { icon: Sparkles, text: "Explains step by step, in English or Roman Urdu" },
];

/** What students see while the AI features are switched off (MVP): AIBuddy says hi. */
export function BuddyComingSoon() {
  return (
    <div className="grid gap-5">
      <section className="grid justify-items-center gap-3 rounded-card border border-sep bg-surface px-5 py-8 text-center">
        <AIBuddyMascot mood="wink" size={168} title="AIBuddy, winking" />
        <span className="rounded-pill bg-tint px-3 py-1 text-footnote font-semibold text-tint-text">
          COMING SOON
        </span>
        <h2 className="text-[24px] leading-tight font-bold">AIBuddy is almost ready</h2>
        <p className="max-w-sm text-sec">
          Soft on the outside, smart on the inside: a study buddy that answers from your
          course&apos;s shared files. We&apos;re finishing it now.
        </p>
      </section>
      <ul className="grid gap-2">
        {PREVIEW.map(({ icon: Icon, text }) => (
          <li
            key={text}
            className="flex items-center gap-3 rounded-card border border-sep bg-surface p-3"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-field bg-raised text-sec">
              <Icon className="size-4" />
            </span>
            <span className="text-sm">{text}</span>
          </li>
        ))}
      </ul>
      <p className="text-center text-sm text-sec">
        Meanwhile, share notes in your{" "}
        <Link href="/courses" className="font-semibold text-accent">
          course rooms
        </Link>
        . AIBuddy will learn from them.
      </p>
    </div>
  );
}
