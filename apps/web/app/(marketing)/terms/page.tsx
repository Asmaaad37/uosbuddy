import type { Metadata } from "next";
import Link from "next/link";
import { ContactLine, LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms",
  description: "The rules for using UOSBuddy.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms" updated="26 October 2026">
      <p>
        By using UOSBuddy you agree to these terms. UOSBuddy is run by students and is not an
        official University of Sargodha service.
      </p>

      <section>
        <h2>Who can join</h2>
        <p>
          UOSBuddy is for current and incoming University of Sargodha students. You need to verify
          that you study at UoS, with your university email or a document, before you can see other
          students.
        </p>
      </section>

      <section>
        <h2>Your account</h2>
        <ul>
          <li>Give your real name and your own student details and documents.</li>
          <li>Keep one account, and don&apos;t share it or let someone else use it.</li>
          <li>Never pretend to be another person.</li>
        </ul>
      </section>

      <section>
        <h2>How to behave</h2>
        <ul>
          <li>Be respectful. No harassment, threats, hate or bullying.</li>
          <li>Don&apos;t share other people&apos;s personal details without their permission.</li>
          <li>No spam, scams or selling things that are illegal or against university rules.</li>
        </ul>
        <p>
          We may remove content or suspend accounts that break these rules, and we review reports
          from other students.
        </p>
      </section>

      <section>
        <h2>What you post</h2>
        <p>
          You own what you post. You let us show it to other students as part of UOSBuddy, according
          to your privacy settings. You&apos;re responsible for what you post.
        </p>
      </section>

      <section>
        <h2>No guarantees</h2>
        <p>
          We work hard to keep UOSBuddy safe and available, but we provide it as it is. We
          can&apos;t promise it will always be available or error-free, and we aren&apos;t
          responsible for what other students say or do.
        </p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          We may update these terms; the date at the top shows the latest version. See our{" "}
          <Link href="/privacy" className="font-semibold text-brand">
            privacy page
          </Link>{" "}
          for how we handle your data. For questions, <ContactLine />.
        </p>
      </section>
    </LegalPage>
  );
}
