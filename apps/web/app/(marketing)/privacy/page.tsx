import type { Metadata } from "next";
import { ContactLine, LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What UOSBuddy collects, who can see it, and how long we keep it.",
};

// Keep this in step with what the app actually does; update it when a feature changes.
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="17 November 2026">
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
            <strong>What you do in the app:</strong> posts, comments, messages, files you share,
            rides, listings, events you RSVP to, your timetable and your AI Buddy chats.
          </li>
          <li>
            <strong>Technical data:</strong> a cookie that keeps you logged in, and which days you
            used the app (to count active students). Your IP address is checked to stop spam on a
            few forms. If you turn on notifications, your browser gives us an address to send them
            to. If we turn on error reporting or usage analytics, they record errors and page
            visits, not what you type.
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
            <strong>Anonymous posts</strong> don&apos;t show your name to students or student
            moderators. An admin can see who wrote one when it&apos;s reported, and each time they
            do it&apos;s recorded.
          </li>
          <li>
            <strong>Reports:</strong> the person you report isn&apos;t told. Moderators see the
            report; only admins can see who sent it.
          </li>
          <li>
            <strong>Nobody else.</strong> We don&apos;t sell your data, share it with advertisers or
            show ads.
          </li>
        </ul>
      </section>

      <section>
        <h2>AI features</h2>
        <ul>
          <li>
            <strong>AI Buddy</strong> sends your question and excerpts from your course&apos;s
            shared files to Anthropic (Claude) to write an answer.
          </li>
          <li>
            <strong>Moderation:</strong> when it&apos;s switched on, the text of posts, comments and
            listings is checked by Claude before it&apos;s published. People, not AI, decide on
            removals and bans.
          </li>
          <li>
            <strong>Verification:</strong> your proof document may be read by Claude to help a
            verifier check it faster. A person always makes the decision.
          </li>
          <li>
            <strong>Timetable import:</strong> a screenshot you upload is read by Claude to fill in
            your classes.
          </li>
        </ul>
        <p>
          Anthropic processes this only to provide the answer and doesn&apos;t use it to train its
          models.
        </p>
      </section>

      <section>
        <h2>How long we keep it</h2>
        <ul>
          <li>
            Your verification document is deleted automatically 30 days after it&apos;s reviewed.
            Uploads that are never submitted are deleted after 30 days.
          </li>
          <li>
            Files from posts, messages, listings and course resources are deleted when what they
            belonged to is deleted or removed. Uploads that are never used are deleted after a day.
          </li>
          <li>
            Chats for a Backup request close when it&apos;s done and are deleted 72 hours later.
            &ldquo;You free?&rdquo; pings are deleted a day after they end. A ride&apos;s chat
            closes when the ride is cancelled or over, and stays readable.
          </li>
          <li>Everything else stays while your account exists.</li>
          <li>
            You can delete your account in <strong>Me → Data</strong>. Your profile, posts and
            comments are hidden straight away and permanently deleted after 14 days (log in before
            then to change your mind). Messages you sent stay in other people&apos;s chats without
            your name.
          </li>
          <li>Data exports are deleted after 7 days.</li>
        </ul>
      </section>

      <section>
        <h2>Where it&apos;s stored</h2>
        <p>
          Your data is stored with Supabase (database and files, in Mumbai, India). These services
          also process data for us, only as needed to run UOSBuddy:
        </p>
        <ul>
          <li>
            <strong>Vercel</strong> hosts the website.
          </li>
          <li>
            <strong>Cloudflare Turnstile</strong> checks that sign-up and login forms are used by a
            person, not a bot.
          </li>
          <li>
            <strong>Upstash</strong> holds short-lived counters (by account or IP address) that stop
            spam, and caches some results for up to a day.
          </li>
          <li>
            <strong>Your browser&apos;s push service</strong> (from Google, Apple, Mozilla or
            Microsoft, depending on your browser) delivers notifications. Message notifications
            include the text unless you turn off <strong>Show message text</strong> in Me →
            Notifications.
          </li>
          <li>
            <strong>An email provider</strong> sends account, status and weekly emails.
          </li>
          <li>
            <strong>Anthropic</strong> runs the AI features above.
          </li>
          <li>
            <strong>Sentry</strong> (error reports) and <strong>PostHog</strong> (page visits, with
            on-screen text hidden), if we turn them on.
          </li>
        </ul>
      </section>

      <section>
        <h2>Questions</h2>
        <p>
          Download a copy of your data any time in <strong>Me → Data</strong>. For anything else,{" "}
          <ContactLine />.
        </p>
      </section>
    </LegalPage>
  );
}
