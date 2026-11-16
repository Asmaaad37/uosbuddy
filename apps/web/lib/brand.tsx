/**
 * The UOSBuddy mark ("Buddy"): a friendly face whose smile is a U, white on the brand blue.
 * Drawn on a 100×100 grid. Used by the app icons and share cards; emails show the PNG icon,
 * because most mail apps don't display SVG.
 */
export const BRAND = {
  blue: "#2563eb",
  ink: "#0b1220",
  night: "#0b0f17",
  mist: "#f2f4f7",
  sec: "#5a6475",
} as const;

/** The face alone, without the tile, so a caller can place it on any background. */
export function BuddyFace({ size, color = "#ffffff" }: { size: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx="36" cy="40" r="7" fill={color} />
      <circle cx="64" cy="40" r="7" fill={color} />
      <path
        d="M31 56 a19 19 0 0 0 38 0"
        fill="none"
        stroke={color}
        strokeWidth="9"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** The app-icon tile: the face on a rounded brand-blue square. */
export function BuddyMark({ size, radius = 0.23 }: { size: number; radius?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BRAND.blue,
        borderRadius: size * radius,
      }}
    >
      <BuddyFace size={size} />
    </div>
  );
}
