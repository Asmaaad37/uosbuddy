/**
 * Words that suggest someone may be thinking of hurting themselves, in English, Roman Urdu and
 * Urdu. It only decides whether to show the writer where to find help; it never blocks,
 * hides or reports anything, so a false match costs little.
 */
const SELF_HARM = [
  "suicide",
  "suicidal",
  "kill myself",
  "killing myself",
  "end my life",
  "ending my life",
  "want to die",
  "wanna die",
  "self harm",
  "self-harm",
  "hurt myself",
  "cut myself",
  "no reason to live",
  "khudkushi",
  "khud kushi",
  "khudkashi",
  "marna chahta",
  "marna chahti",
  "mar jana chahta",
  "mar jana chahti",
  "jeena nahi chahta",
  "jeena nahi chahti",
  "zindagi khatam",
  "خودکشی",
  "مرنا چاہتا",
  "مرنا چاہتی",
];

export function mentionsSelfHarm(text: string) {
  const t = text.toLowerCase().replace(/\s+/g, " ");
  return SELF_HARM.some((w) => t.includes(w));
}

/** Checked November 2026: in Punjab, 15 also offers mental-health counselling. */
export const HELP = {
  emergency: "1122 (Rescue) or 15",
  directory: "https://findahelpline.com/countries/pk",
} as const;
