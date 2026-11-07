import { Home, MapPin, MessageCircleQuestion } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Pill, Stamp } from "@/components/ui/badge";
import type { ProfileCardData } from "@/lib/profile.server";
import { RESIDENCE_LABELS, studiesLine } from "@/lib/profile";
import { departmentShortName } from "@/lib/setup";

/** VERIFIED for every student here, plus UOS EMAIL and MENTOR when earned. */
export function ProfileStamps({
  hasUniEmail,
  isMentor,
}: {
  hasUniEmail: boolean | null;
  isMentor?: boolean | null;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Stamp tone="verified">Verified</Stamp>
      {hasUniEmail && <Stamp tone="email">UoS email</Stamp>}
      {isMentor && <Stamp tone="mentor">Mentor</Stamp>}
    </div>
  );
}

/** Section 6.3 profile: everything another student is allowed to see, nothing more. */
export function ProfileCard({
  profile,
  actions,
}: {
  profile: ProfileCardData;
  /** Connect / Message buttons, under the name. */
  actions?: React.ReactNode;
}) {
  const name = profile.full_name ?? profile.handle ?? "Student";
  const studies = studiesLine(profile);
  const residence =
    profile.residence && profile.residence !== "other" ? RESIDENCE_LABELS[profile.residence] : null;

  return (
    <article className="grid gap-5">
      <header className="flex items-center gap-4">
        <Avatar name={name} src={profile.avatar_url} size="xl" />
        <div className="grid min-w-0 gap-1.5">
          <h1 className="text-2xl leading-tight font-bold break-words">{name}</h1>
          {profile.handle && <p className="text-sec">@{profile.handle}</p>}
          <ProfileStamps hasUniEmail={profile.has_uni_email} isMentor={profile.is_mentor} />
        </div>
      </header>

      {actions}

      {(profile.programName || profile.departmentName || studies) && (
        <section aria-label="Studies" className="grid gap-0.5">
          <p className="font-semibold">
            {profile.programName ??
              (profile.departmentName && departmentShortName(profile.departmentName))}
          </p>
          {profile.programName && profile.departmentName && (
            <p className="text-sm text-sec">{departmentShortName(profile.departmentName)}</p>
          )}
          {studies && <p className="text-sm text-sec">{studies}</p>}
        </section>
      )}

      {(profile.hometown_city || residence) && (
        <div className="flex flex-wrap gap-2">
          {profile.hometown_city && (
            <Pill tone="outline">
              <MapPin className="size-4" /> {profile.hometown_city}
            </Pill>
          )}
          {residence && (
            <Pill tone="outline">
              <Home className="size-4" /> {residence}
            </Pill>
          )}
        </div>
      )}

      {profile.bio && <p className="leading-relaxed whitespace-pre-line">{profile.bio}</p>}

      {profile.opening_move_prompt && profile.opening_move && (
        <section
          aria-label="Opening Move"
          className="grid gap-1 rounded-card border border-sep bg-surface p-4 shadow-card"
        >
          <p className="flex items-center gap-1.5 text-sm font-semibold text-accent">
            <MessageCircleQuestion className="size-4" /> {profile.opening_move_prompt}
          </p>
          <p className="text-lg font-semibold">{profile.opening_move}</p>
        </section>
      )}

      {profile.interests.length > 0 && (
        <section aria-label="Interests" className="grid gap-2">
          <h2 className="text-sm font-semibold text-sec">Into</h2>
          <ul className="flex flex-wrap gap-2">
            {profile.interests.map((i) => (
              <li key={i.id}>
                <Pill tone="people">
                  {i.emoji && <span aria-hidden>{i.emoji}</span>}
                  {i.label}
                </Pill>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
