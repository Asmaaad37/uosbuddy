import { describe, expect, it } from "vitest";
import { timeLeft } from "./backup";

describe("timeLeft", () => {
  const now = new Date("2026-11-02T10:00:00Z");
  it("counts down in minutes, hours, then days", () => {
    expect(timeLeft("2026-11-02T10:45:00Z", now)).toBe("45m left");
    expect(timeLeft("2026-11-02T13:00:00Z", now)).toBe("3h left");
    expect(timeLeft("2026-11-05T10:00:00Z", now)).toBe("3d left");
    expect(timeLeft("2026-11-02T09:00:00Z", now)).toBe("Ended");
  });
});
