import { ImageResponse } from "next/og";

// Placeholder PWA icons until the UOSBuddy mark is designed (Section 6.6).
const variants = {
  "192": { size: 192, safe: 1 },
  "512": { size: 512, safe: 1 },
  // Maskable icons keep content inside the central 80% safe zone.
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
  const fontSize = Math.round(size * 0.5 * safe);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0034D3",
        borderRadius: safe < 1 ? 0 : size * 0.22,
      }}
    >
      <div
        style={{
          color: "#F2ECE1",
          fontSize,
          fontWeight: 800,
          letterSpacing: -fontSize * 0.04,
          display: "flex",
        }}
      >
        U<span style={{ color: "#99CCFF" }}>B</span>
      </div>
    </div>,
    { width: size, height: size },
  );
}
