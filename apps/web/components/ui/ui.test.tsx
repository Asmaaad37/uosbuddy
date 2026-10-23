import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Field, Input } from "./input";

afterEach(cleanup);

describe("cn", () => {
  it("lets later classes win conflicts", () => {
    expect(cn("h-12 px-6", "px-4")).toBe("h-12 px-4");
  });
});

describe("Button", () => {
  it("renders a pill with a 48px default height", () => {
    render(<Button>Get started</Button>);
    const button = screen.getByRole("button", { name: "Get started" });
    expect(button.className).toContain("rounded-pill");
    expect(button.className).toContain("h-12");
  });

  it("renders its child element when asChild is set", () => {
    render(
      <Button asChild>
        <a href="/design">Design</a>
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Design" }).className).toContain("rounded-pill");
  });
});

describe("Field", () => {
  it("links the label, hint and error to the control", () => {
    render(
      <Field id="roll" label="Roll number" hint="Only an admin sees this." error="Invalid">
        {(aria) => <Input {...aria} />}
      </Field>,
    );
    const input = screen.getByLabelText("Roll number");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("roll-hint roll-error");
  });
});
