import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AIBuddyMascot } from "./ai-buddy-mascot";

describe("AIBuddy mascot", () => {
  it("is a labelled image, or hidden when decorative", () => {
    const { getByRole, container, rerender } = render(<AIBuddyMascot title="AIBuddy" />);
    expect(getByRole("img", { name: "AIBuddy" })).toBeTruthy();
    rerender(<AIBuddyMascot title="" />);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("thinks with bubbles, and crops to the face for small sizes", () => {
    const { container, rerender } = render(<AIBuddyMascot mood="thinking" />);
    expect(container.querySelectorAll("circle[fill], g[fill] circle").length).toBeGreaterThan(3);
    rerender(<AIBuddyMascot face size={40} />);
    expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe("36 46 128 104");
  });

  it("gives each copy its own gradient ids", () => {
    const { container } = render(
      <>
        <AIBuddyMascot />
        <AIBuddyMascot />
      </>,
    );
    const ids = [...container.querySelectorAll("radialGradient")].map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
