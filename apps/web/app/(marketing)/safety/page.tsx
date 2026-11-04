import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";
import { RIDE_SAFETY_TIPS } from "@/lib/campus";

export const metadata: Metadata = {
  title: "Safety centre",
  description: "How to report, stay safe and get help on UOSBuddy.",
};

/** Phase 9 task 5: reporting, privacy tools, women's safety and emergency numbers. */
export default function SafetyPage() {
  return (
    <LegalPage title="Safety centre" updated="4 November 2026">
      <p>
        Everyone on UOSBuddy is a verified UoS student, but you should still look after yourself.
        Here&apos;s how.
      </p>

      <section>
        <h2>If you&apos;re in danger, call now</h2>
        <ul>
          <li>
            <strong>15</strong>: Police
          </li>
          <li>
            <strong>1122</strong>: Rescue (ambulance and fire)
          </li>
          <li>
            <strong>1043</strong>: Punjab Women&apos;s Helpline
          </li>
          <li>
            <strong>115</strong>: Edhi ambulance
          </li>
        </ul>
        <p>UOSBuddy can&apos;t send help in an emergency. Please call.</p>
      </section>

      <section>
        <h2>Report anything that breaks the rules</h2>
        <p>
          Use <strong>Report</strong> in the ⋯ menu on any profile, message, post, comment, listing,
          ride or event. Reports are private: the person isn&apos;t told who reported them. Admins
          and student moderators review reports and can remove content, warn or ban accounts. Read
          the{" "}
          <Link href="/guidelines" className="font-semibold text-brand">
            community guidelines
          </Link>
          .
        </p>
      </section>

      <section>
        <h2>Control who sees and contacts you</h2>
        <ul>
          <li>
            In <strong>Me → Privacy</strong>, choose who sees your profile and photo, and who can
            message you.
          </li>
          <li>
            <strong>Block</strong> someone from their profile: they can&apos;t find or message you,
            and you won&apos;t see them.
          </li>
          <li>Your phone number, email and roll number are never shown to other students.</li>
          <li>
            In <strong>Me → Data</strong>, download everything we hold about you, or delete your
            account.
          </li>
        </ul>
      </section>

      <section>
        <h2>Women&apos;s safety</h2>
        <ul>
          <li>
            Women students can ask for access to <strong>women-only rides</strong> in Me → Privacy.
            An admin confirms each request, so these spaces stay women-only.
          </li>
          <li>Keep meet-ups in busy places on campus, especially when meeting someone new.</li>
          <li>Anyone who sends unwanted photos or messages: block and report. We act on it.</li>
        </ul>
      </section>

      <section>
        <h2>Rides and the market</h2>
        <ul>
          {RIDE_SAFETY_TIPS.map((t) => (
            <li key={t}>{t}</li>
          ))}
          <li>For the market: meet on campus, check the item first, and never pay in advance.</li>
        </ul>
      </section>
    </LegalPage>
  );
}
