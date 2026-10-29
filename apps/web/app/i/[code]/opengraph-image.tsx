import { ImageResponse } from "next/og";
import { getInvitePreview } from "@/lib/invites.server";

export const alt = "Find your batch on UOSBuddy";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Share card for invite links: "143 of CS 2024 are on UOSBuddy" (Phase 3 task 6). */
export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const preview = await getInvitePreview((await params).code);
  const hasBatch = !!preview?.batch;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "#f2ece1",
        backgroundImage: "radial-gradient(#ddd5c6 2px, transparent 2px)",
        backgroundSize: "28px 28px",
        color: "#0b0838",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: 6,
          color: "#0034d3",
        }}
      >
        UOSBUDDY
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {hasBatch ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                fontSize: 200,
                fontWeight: 800,
                lineHeight: 1,
                color: "#0034d3",
              }}
            >
              {preview!.count}
            </div>
            <div style={{ display: "flex", fontSize: 64, fontWeight: 700, lineHeight: 1.1 }}>
              {`of ${preview!.batch} ${preview!.count === 1 ? "is" : "are"} on UOSBuddy`}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", fontSize: 110, fontWeight: 800, lineHeight: 1 }}>
            FIND YOUR BATCH.
          </div>
        )}
      </div>
      <div style={{ display: "flex", fontSize: 32, color: "#4a4766" }}>
        {preview
          ? `${preview.firstName} invited you · Verified University of Sargodha students`
          : "Verified University of Sargodha students"}
      </div>
    </div>,
    size,
  );
}
