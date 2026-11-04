import { ImageResponse } from "next/og";

export const alt = "UOSBuddy: find your batch at University of Sargodha";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Phase 10 launch kit: the share card for the landing page (and any page without its own). */
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
        <div style={{ display: "flex", fontSize: 120, fontWeight: 800, lineHeight: 1 }}>
          FIND YOUR BATCH.
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 120,
            fontWeight: 800,
            lineHeight: 1,
            color: "#0034d3",
          }}
        >
          FIND YOUR PEOPLE.
        </div>
      </div>
      <div style={{ display: "flex", fontSize: 32, color: "#4a4766" }}>
        Classmates, notes, rides and backup · Verified University of Sargodha students
      </div>
    </div>,
    size,
  );
}
