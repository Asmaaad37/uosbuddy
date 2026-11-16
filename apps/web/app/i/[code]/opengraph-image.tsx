import { ImageResponse } from "next/og";
import { BRAND, BuddyMark } from "@/lib/brand";
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
        background: BRAND.night,
        color: "#f3f5f9",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <BuddyMark size={72} />
        <div style={{ display: "flex", fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>
          UOSBuddy
        </div>
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
                color: "#5b9bff",
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
            Find your batch.
          </div>
        )}
      </div>
      <div style={{ display: "flex", fontSize: 30, color: "#a1a9b8" }}>
        {preview
          ? `${preview.firstName} invited you · Verified University of Sargodha students`
          : "Verified University of Sargodha students"}
      </div>
    </div>,
    size,
  );
}
