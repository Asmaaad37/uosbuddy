import type { Database } from "@uosbuddy/shared";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Enums = Database["public"]["Enums"];

export const SHIFT_LABELS: Record<Enums["shift_type"], string> = {
  morning: "Morning",
  evening: "Evening",
  weekend: "Weekend",
};

export const RESIDENCE_LABELS: Record<Enums["residence_type"], string> = {
  day_scholar: "Day scholar",
  hostelite: "Hostelite",
  other: "Other",
};

/** "Batch 2024 · Semester 3 · Section B · Morning", leaving out whatever is missing. */
export function studiesLine(p: {
  batch_year: number | null;
  semester: number | null;
  section: string | null;
  shift: Enums["shift_type"] | null;
}) {
  return [
    p.batch_year && `Batch ${p.batch_year}`,
    p.semester && `Semester ${p.semester}`,
    p.section && `Section ${p.section}`,
    p.shift && SHIFT_LABELS[p.shift],
  ]
    .filter(Boolean)
    .join(" · ");
}

export type CompletenessInput = Pick<
  Profile,
  "avatar_url" | "bio" | "hometown_city" | "section" | "opening_move"
> & { interestCount: number; hasUniEmail: boolean };

export type Nudge = { key: string; label: string; href: string };

/** Interests needed before suggestions get useful. */
export const MIN_INTERESTS = 3;

const CHECKS: {
  key: string;
  label: string;
  href: string;
  done: (p: CompletenessInput) => boolean;
}[] = [
  {
    key: "photo",
    label: "Add a photo",
    href: "/setup/about?edit=1",
    done: (p) => !!p.avatar_url,
  },
  {
    key: "bio",
    label: "Write a short bio",
    href: "/setup/about?edit=1",
    done: (p) => !!p.bio?.trim(),
  },
  {
    key: "hometown",
    label: "Add your hometown",
    href: "/setup/about?edit=1",
    done: (p) => !!p.hometown_city?.trim(),
  },
  {
    key: "section",
    label: "Add your section",
    href: "/setup/academic?edit=1",
    done: (p) => !!p.section?.trim(),
  },
  {
    key: "interests",
    label: `Pick at least ${MIN_INTERESTS} interests`,
    href: "/setup/interests?edit=1",
    done: (p) => p.interestCount >= MIN_INTERESTS,
  },
  {
    key: "opening_move",
    label: "Answer an Opening Move",
    href: "/setup/interests?edit=1",
    done: (p) => !!p.opening_move?.trim(),
  },
  {
    key: "uni_email",
    label: "Link your UoS email",
    href: "/me/email",
    done: (p) => p.hasUniEmail,
  },
];

/** Profile completeness (feature 13): a percentage and what's still missing, in order. */
export function completeness(profile: CompletenessInput): { percent: number; nudges: Nudge[] } {
  const nudges = CHECKS.filter((c) => !c.done(profile)).map(({ key, label, href }) => ({
    key,
    label,
    href,
  }));
  const percent = Math.round(((CHECKS.length - nudges.length) / CHECKS.length) * 100);
  return { percent, nudges };
}
