import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnswerText } from "./answer-text";

describe("AnswerText", () => {
  it("shows bold, code and lists instead of raw symbols", () => {
    const { container } = render(
      <AnswerText
        text={"A **pivot** splits it.\n\n- pick `p`\n- partition\n\n1. sort left\n2. sort right"}
      />,
    );
    expect(container.querySelector("strong")?.textContent).toBe("pivot");
    expect(container.querySelector("code")?.textContent).toBe("p");
    expect(container.querySelectorAll("ul li")).toHaveLength(2);
    expect(container.querySelectorAll("ol li")).toHaveLength(2);
    expect(container.textContent).not.toContain("**");
  });

  it("never turns the model's text into HTML", () => {
    const { container } = render(<AnswerText text={'<img src=x onerror="alert(1)"> **hi**'} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
  });
});
