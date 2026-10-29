import type { Metadata } from "next";
import { ContactLine, LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What UOSBuddy collects, who can see it, and how long we keep it.",
};

// Keep this in step with what the app actually does; update it when a feature changes.
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="26 October 2026">
      <p>
        UOSBuddy helps University of Sargodha students find their batch and classmates. It&apos;s
        run by students and is not an official University of Sargodha service. This page explains
        what we collect, who can see it and how long we keep it.
      </p>

      <section>
        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Your account:</strong> your name, your email address, and a password if you set
            one. Passwords are stored only as a secure hash; we can&apos;t read them.
          </li>
          <li>
            <strong>Verification:</strong> if you join without a university email, your roll or
            registration number, an optional WhatsApp number, and a photo or PDF of a document that
            shows you study at UoS.
          </li>
          <li>
            <strong>Your profile:</strong> anything you choose to add later, such as your
            department, batch, section, photo, bio and interests.
          </li>
          <li>
            <strong>Technical data:</strong> a cookie that keeps you logged in. If we turn on error
            reporting or usage analytics, they record errors and page visits, not what you type.
          </li>
        </ul>
      </section>

      <section>
        <h2>Who can see it</h2>
        <ul>
          <li>
            <strong>Other verified UoS students</strong> can see your profile, limited by your
            privacy settings. People who aren&apos;t verified can&apos;t see anyone&apos;s profile.
          </li>
          <li>
            <strong>Only you and our verifiers</strong> can see your roll number, WhatsApp number,
            email address and verification document. They are never shown on your profile.
          </li>
          <li>
            <strong>Nobody else.</strong> We don&apos;t sell your data, share it with advertisers or
            show ads.
          </li>
        </ul>
      </section>

      <section>
        <h2>How long we keep it</h2>
        <ul>
          <li>
            Your verification document is deleted automatically 30 days after it&apos;s reviewed.
            Uploads that are never submitted are deleted after 30 days.
          </li>
          <li>Everything else stays while your account exists.</li>
          <li>
            To delete your account and its data, <ContactLine />.
          </li>
        </ul>
      </section>

      <section>
        <h2>Where it&apos;s stored</h2>
        <p>
          Your data is stored with Supabase (database and files, in Mumbai, India). The website is
          hosted on Vercel. Account and status emails are sent through an email provider. These
          services process data for us and only as needed to run UOSBuddy.
        </p>
      </section>

      <section>
        <h2>Questions</h2>
        <p>
          To ask about your data or request a copy of it, <ContactLine />.
        </p>
      </section>
    </LegalPage>
  );
}
