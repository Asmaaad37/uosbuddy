import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";
import { CONSEQUENCES, GUIDELINES } from "@/lib/guidelines";

export const metadata: Metadata = {
  title: "Community guidelines",
  description: "How UOSBuddy stays a good place for UoS students.",
};

/** Phase 9 task 5: the community guidelines students accept before posting. */
export default function GuidelinesPage() {
  return (
    <LegalPage title="Community guidelines" updated="4 November 2026">
      <p>
        UOSBuddy is for University of Sargodha students to find each other, learn together and help
        out. These rules apply everywhere: posts, comments, chats, the market, rides and events,
        named or anonymous.
      </p>
      <section>
        <ol>
          {GUIDELINES.map((g) => (
            <li key={g.title}>
              <strong>{g.title}.</strong> {g.body}
            </li>
          ))}
        </ol>
      </section>
      <section>
        <h2>What happens when rules are broken</h2>
        <p>{CONSEQUENCES}</p>
        <p>
          AI helps flag posts for review, but people make the decisions: our admins and verified
          student moderators. Every moderation action is recorded.
        </p>
      </section>
      <section>
        <h2>Need help?</h2>
        <p>
          See the{" "}
          <Link href="/safety" className="font-semibold text-accent">
            safety centre
          </Link>{" "}
          for how to report, stay safe, and get help in an emergency.
        </p>
      </section>
    </LegalPage>
  );
}
