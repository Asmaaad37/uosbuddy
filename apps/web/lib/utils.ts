import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge the redesign's token names (globals.css), so a type size like
// `text-headline` isn't mistaken for a text colour and a colour like `text-accent` dropped.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "large-title",
        "title2",
        "section",
        "headline",
        "body",
        "subhead",
        "footnote",
        "overline",
        "tab-label",
      ],
      radius: ["thumb", "track", "field", "btn", "well", "card", "pill"],
      color: [
        "bg",
        "surface",
        "raised",
        "track",
        "thumb",
        "sep",
        "label",
        "sec",
        "ter",
        "accent",
        "fill",
        "on-fill",
        "tint",
        "tint-text",
        "danger",
        "bar",
        "bar-border",
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
