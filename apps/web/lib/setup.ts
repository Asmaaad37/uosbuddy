import type { Database } from "@uosbuddy/shared";

type Visibility = Database["public"]["Enums"]["visibility_level"];

/** Setup screens 6–9 in order. `profiles.onboarding_step` counts the ones completed. */
export const SETUP_STEPS = ["academic", "about", "interests", "privacy"] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

export function stepNumber(step: SetupStep) {
  return SETUP_STEPS.indexOf(step) + 1;
}

/** Where to resume: the first step not yet completed. */
export function resumeStep(onboardingStep: number): SetupStep {
  return SETUP_STEPS[Math.min(Math.max(onboardingStep, 0), SETUP_STEPS.length - 1)]!;
}

/** Opening Move prompts (screen 8): one answer makes starting a chat less awkward. */
export const OPENING_MOVES = [
  "Ask me about…",
  "Best chai spot near campus is…",
  "My go-to canteen order is…",
  "I'll never stop talking about…",
  "Looking for people to…",
  "This semester I'm trying to…",
  "My hometown is famous for…",
  "Unpopular opinion:",
] as const;

export type PrivacySettings = {
  profile_visibility: Visibility;
  photo_visibility: Visibility;
  allow_dms_from: Visibility;
  show_hometown: boolean;
  show_in_directory: boolean;
};

/** Screen 9 presets. "Custom" is whatever doesn't match one of these exactly. */
export const PRIVACY_PRESETS = {
  open: {
    label: "Open",
    description: "Any verified UoS student can find you, see your photo and message you.",
    settings: {
      profile_visibility: "everyone",
      photo_visibility: "everyone",
      allow_dms_from: "everyone",
      show_hometown: true,
      show_in_directory: true,
    },
  },
  batch: {
    label: "Batch only",
    description: "Only your department batch sees your profile and photo and can message you.",
    settings: {
      profile_visibility: "batch",
      photo_visibility: "batch",
      allow_dms_from: "batch",
      show_hometown: true,
      show_in_directory: true,
    },
  },
  private: {
    label: "Private",
    description: "Hidden from the directory. Only your connections see your profile and photo.",
    settings: {
      profile_visibility: "connections",
      photo_visibility: "connections",
      allow_dms_from: "connections",
      show_hometown: false,
      show_in_directory: false,
    },
  },
} satisfies Record<string, { label: string; description: string; settings: PrivacySettings }>;

export type PrivacyPreset = keyof typeof PRIVACY_PRESETS;

export function matchPreset(settings: PrivacySettings): PrivacyPreset | "custom" {
  const keys = Object.keys(PRIVACY_PRESETS.open.settings) as (keyof PrivacySettings)[];
  for (const [name, preset] of Object.entries(PRIVACY_PRESETS)) {
    if (keys.every((k) => preset.settings[k] === settings[k])) return name as PrivacyPreset;
  }
  return "custom";
}

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  everyone: "All verified UoS students",
  department: "My department",
  batch: "My batch",
  connections: "My connections",
  nobody: "Nobody",
};

/**
 * Session start years offered in the academic step, newest first. From November, next
 * year's Spring intake can sign up before classes start, so that year is offered too.
 */
export function batchYears(now = new Date()) {
  const latest = now.getFullYear() + (now.getMonth() >= 10 ? 1 : 0);
  return Array.from({ length: 12 }, (_, i) => latest - i);
}

/** "F22" in a UoS roll number (or "22F" in a registration number) → 2022. */
export function batchYearFromStudentId(id: string | null | undefined) {
  if (!id) return null;
  const m = /^[A-Z]{2,8}?\d{2}[FS](\d{2})[A-Z]\d{3}$/.exec(id) ?? /^(\d{2})[FS]-US-/.exec(id);
  return m ? 2000 + Number(m[1]) : null;
}
