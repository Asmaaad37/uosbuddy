import { ImageResponse } from "next/og";
import { BRAND, BuddyMark } from "@/lib/brand";

export const alt = "UOSBuddy: find your batch at University of Sargodha";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The share card for the landing page (and any page without its own), in the app's colours. */
export default function Image() {
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
        <div
          style={{
            display: "flex",
            fontSize: 104,
            fontWeight: 800,
            lineHeight: 1.02,
            letterSpacing: -3,
          }}
        >
          Find your batch.
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 104,
            fontWeight: 800,
            lineHeight: 1.02,
            letterSpacing: -3,
            color: "#5b9bff",
          }}
        >
          Find your people.
        </div>
      </div>
      <div style={{ display: "flex", fontSize: 30, color: "#a1a9b8" }}>
        Classmates, notes, rides and backup · Verified University of Sargodha students
      </div>
    </div>,
    size,
  );
}
