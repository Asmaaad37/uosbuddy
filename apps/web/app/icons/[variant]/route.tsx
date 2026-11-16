import { ImageResponse } from "next/og";
import { BRAND, BuddyFace } from "@/lib/brand";

// App and browser icons: the Buddy mark (lib/brand.tsx).
//   192, 512  the rounded tile, for the browser and the "install" prompt.
//   maskable  fills the square; Android crops it to its own shape, so the face keeps to the
//             central 80% safe zone.
//   apple     full-bleed square: iOS rounds the corners itself and paints transparent ones black.
//   favicon   small tile for browser tabs and bookmarks (also served at /favicon.ico).
//   badge     the face alone on transparent: Android shows notification badges as a one-colour
//             silhouette, so a filled square would appear as a plain white block.
const variants = {
  "192": { size: 192, safe: 1, tile: "rounded" },
  "512": { size: 512, safe: 1, tile: "rounded" },
  maskable: { size: 512, safe: 0.8, tile: "square" },
  apple: { size: 180, safe: 0.9, tile: "square" },
  favicon: { size: 48, safe: 1, tile: "rounded" },
  badge: { size: 96, safe: 1.15, tile: "none" },
} as const;

type Variant = keyof typeof variants;

export const dynamic = "force-static";

export function generateStaticParams() {
  return Object.keys(variants).map((variant) => ({ variant }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ variant: string }> }) {
  const { variant } = await params;
  const spec = variants[variant as Variant];
  if (!spec) return new Response("Not found", { status: 404 });

  const { size, safe, tile } = spec;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: tile === "none" ? "transparent" : BRAND.blue,
        borderRadius: tile === "rounded" ? size * 0.23 : 0,
      }}
    >
      <BuddyFace size={Math.round(size * safe)} />
    </div>,
    {
      width: size,
      height: size,
      // Icons change rarely, but a new logo must reach phones: a day, then revalidate.
      headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
    },
  );
}
