import { describe, expect, it } from "vitest";
import { BUDDY_SYSTEM, historyMessages } from "./buddy";

describe("AI Buddy history", () => {
  it("starts with the student even when an earlier answer failed", () => {
    // Newest first, as loaded: the window opens on an answer whose question fell outside it.
    const rows = [
      { role: "assistant", content: "Recursion calls itself." },
      { role: "user", content: "What is recursion?" },
      { role: "assistant", content: "A pivot splits the list." },
    ];
    expect(historyMessages(rows)).toEqual([
      { role: "user", content: "What is recursion?" },
      { role: "assistant", content: "Recursion calls itself." },
    ]);
  });

  it("drops empty and unknown turns", () => {
    expect(
      historyMessages([
        { role: "user", content: "  " },
        { role: "system", content: "x" },
      ]),
    ).toEqual([]);
  });

  it("points a student in distress to help", () => {
    expect(BUDDY_SYSTEM).toMatch(/hurt themselves/);
    expect(BUDDY_SYSTEM).toMatch(/Safety centre/);
  });
});
