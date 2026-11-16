import { ImageResponse } from "next/og";
import { BRAND, BuddyFace } from "@/lib/brand";

// PWA and browser icons: the Buddy mark (lib/brand.tsx).
const variants = {
  "192": { size: 192, safe: 1 },
  "512": { size: 512, safe: 1 },
  // Maskable icons fill the square; Android crops to its own shape, so the face keeps to
  // the central 80% safe zone.
  maskable: { size: 512, safe: 0.8 },
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

  const { size, safe } = spec;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BRAND.blue,
        borderRadius: safe < 1 ? 0 : size * 0.23,
      }}
    >
      <BuddyFace size={Math.round(size * safe)} />
    </div>,
    { width: size, height: size },
  );
}
