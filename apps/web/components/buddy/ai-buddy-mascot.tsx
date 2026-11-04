import { useId } from "react";
import { cn } from "@/lib/utils";

export type BuddyMood = "idle" | "thinking" | "answering" | "celebrating" | "oops" | "wink";

/**
 * AIBuddy, the AI study buddy's mascot (from the project owner's character sheet): a furry
 * blue chat bubble with a glowing antenna. Palette: sky #C6E2FF, fur #4A8DF7, deep #2563EB,
 * glow #67E8F9, ink #0F172A. Moods change only the face (and the antenna's glow). It gently
 * "breathes" unless the student prefers reduced motion; below 48 px, use `face` for a
 * face-only crop.
 */
export function AIBuddyMascot({
  mood = "idle",
  size = 160,
  face = false,
  className,
  title = "AIBuddy",
}: {
  mood?: BuddyMood;
  size?: number;
  face?: boolean;
  className?: string;
  /** Spoken name; pass "" to hide it from screen readers (decorative use). */
  title?: string;
}) {
  const id = useId().replace(/:/g, "");
  const fur = `fur-${id}`;
  const body = `body-${id}`;
  const glow = `glow-${id}`;
  const dim = mood === "oops";
  const decorative = title === "";

  return (
    <svg
      viewBox={face ? "36 46 128 104" : "0 0 200 200"}
      width={size}
      height={face ? size * (104 / 128) : size}
      className={cn("shrink-0 overflow-visible", className)}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : title}
    >
      <defs>
        <radialGradient id={body} cx="38%" cy="28%" r="80%">
          <stop offset="0%" stopColor="#C6E2FF" />
          <stop offset="38%" stopColor="#7FB0FA" />
          <stop offset="68%" stopColor="#4A8DF7" />
          <stop offset="100%" stopColor="#2563EB" />
        </radialGradient>
        {/* Short, clean fur: a fine displacement on the rim and a faint surface grain. */}
        <filter id={fur} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="1.6"
            numOctaves="2"
            seed="7"
            result="n"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="n"
            scale="5"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        <radialGradient id={glow}>
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="35%" stopColor="#67E8F9" />
          <stop offset="100%" stopColor="#67E8F9" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g className="motion-safe:animate-[buddy-bob_3s_ease-in-out_infinite]">
        {!face && (
          <ellipse
            cx="100"
            cy="182"
            rx="52"
            ry="7"
            fill="#0F172A"
            opacity="0.12"
            className="motion-safe:animate-[buddy-shadow_3s_ease-in-out_infinite]"
          />
        )}

        {/* Antenna with its glowing orb (brighter while thinking, dimmed when something's wrong). */}
        <path
          d={dim ? "M100 44 C 100 34, 106 30, 112 30" : "M100 44 C 100 30, 104 22, 110 18"}
          stroke="#2563EB"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />
        <circle
          cx={dim ? 113 : 111}
          cy={dim ? 30 : 17}
          r={mood === "thinking" ? 14 : 11}
          fill={`url(#${glow})`}
          opacity={dim ? 0.35 : 1}
          className={mood === "thinking" ? "motion-safe:animate-pulse" : undefined}
        />
        <circle
          cx={dim ? 113 : 111}
          cy={dim ? 30 : 17}
          r="4.5"
          fill="#E0FBFF"
          opacity={dim ? 0.5 : 1}
        />

        {/* The furry speech bubble, its soft point at the bottom-left. */}
        <path
          d="M100 42 C 148 42, 172 66, 172 98 C 172 132, 146 156, 104 156 C 88 156, 74 153, 63 147 C 54 156, 42 164, 28 166 C 38 156, 42 146, 42 136 C 33 126, 28 113, 28 98 C 28 66, 52 42, 100 42 Z"
          fill={`url(#${body})`}
          filter={`url(#${fur})`}
        />
        <ellipse
          cx="78"
          cy="70"
          rx="26"
          ry="12"
          fill="#ffffff"
          opacity="0.32"
          transform="rotate(-12 78 70)"
        />

        {/* Blush */}
        <ellipse cx="62" cy="114" rx="11" ry="6" fill="#FB7185" opacity="0.5" />
        <ellipse cx="138" cy="114" rx="11" ry="6" fill="#FB7185" opacity="0.5" />

        <Face mood={mood} />
      </g>

      {mood === "celebrating" && (
        // Confetti and sparkles, once (the caller decides when to show this mood).
        <g>
          <rect
            x="34"
            y="40"
            width="7"
            height="7"
            rx="1.5"
            fill="#A78BFA"
            transform="rotate(20 37 43)"
          />
          <rect
            x="160"
            y="34"
            width="6"
            height="6"
            rx="1.5"
            fill="#F472B6"
            transform="rotate(-15 163 37)"
          />
          <rect x="62" y="22" width="6" height="6" rx="1.5" fill="#67E8F9" />
          <rect
            x="176"
            y="96"
            width="6"
            height="6"
            rx="1.5"
            fill="#FCD34D"
            transform="rotate(30 179 99)"
          />
          <path d="M26 92 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 z" fill="#C4B5FD" />
          <path d="M172 120 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 z" fill="#A5F3FC" />
        </g>
      )}

      {mood === "thinking" && (
        <g fill="#C4B5FD" opacity="0.8">
          <circle
            cx="150"
            cy="40"
            r="4"
            className="motion-safe:animate-[buddy-rise_1.8s_ease-in-out_infinite]"
          />
          <circle
            cx="160"
            cy="28"
            r="5.5"
            className="motion-safe:animate-[buddy-rise_1.8s_ease-in-out_0.3s_infinite]"
          />
          <circle
            cx="173"
            cy="14"
            r="7"
            className="motion-safe:animate-[buddy-rise_1.8s_ease-in-out_0.6s_infinite]"
          />
        </g>
      )}
    </svg>
  );
}

const INK = "#0F172A";

function Eye({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx="9" ry="11.5" fill={INK} />
      <circle cx={x - 3} cy={y - 4.5} r="3.6" fill="#fff" />
      <circle cx={x + 3} cy={y + 4} r="1.6" fill="#fff" opacity="0.8" />
    </g>
  );
}

const closed = (x: number, y: number) => `M${x - 9} ${y + 2} Q ${x} ${y - 9}, ${x + 9} ${y + 2}`;

function Face({ mood }: { mood: BuddyMood }) {
  const line = { stroke: INK, strokeWidth: 4, strokeLinecap: "round" as const, fill: "none" };
  switch (mood) {
    case "thinking":
      return (
        <g>
          <Eye x={80} y={96} />
          <Eye x={120} y={96} />
          <path d="M94 122 L106 121" {...line} />
        </g>
      );
    case "answering":
    case "celebrating":
      return (
        <g>
          <path d={closed(80, 98)} {...line} />
          <path d={closed(120, 98)} {...line} />
          <path d="M88 114 Q 100 132, 112 114 Z" fill={INK} />
          <path d="M94 121 Q 100 127, 106 121 Z" fill="#F472B6" />
        </g>
      );
    case "oops":
      return (
        <g>
          <path d="M72 92 L85 99 L72 106" {...line} />
          <path d="M128 92 L115 99 L128 106" {...line} />
          <path d="M88 122 Q 94 116, 100 122 T 112 122" {...line} />
          <path d="M146 76 Q 151 86, 146 90 Q 141 86, 146 76 Z" fill="#BAE6FD" />
        </g>
      );
    case "wink":
      return (
        <g>
          <Eye x={80} y={98} />
          <path d={closed(120, 100)} {...line} />
          <path d="M90 116 Q 100 126, 110 116" {...line} />
        </g>
      );
    default:
      return (
        <g>
          <Eye x={80} y={98} />
          <Eye x={120} y={98} />
          <path d="M91 116 Q 100 124, 109 116" {...line} />
        </g>
      );
  }
}
