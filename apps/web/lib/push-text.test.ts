import { describe, expect, it } from "vitest";
import { messagePushText } from "./push-text";

const base = {
  dm: true,
  chatTitle: null,
  sender: "Ali",
  text: "Meet at 3?",
  isRequest: false,
  previews: true,
};

describe("messagePushText", () => {
  it("shows the message by default", () => {
    expect(messagePushText(base)).toEqual({ title: "Ali", body: "Meet at 3?" });
    expect(messagePushText({ ...base, dm: false, chatTitle: "CS 2024" })).toEqual({
      title: "CS 2024",
      body: "Ali: Meet at 3?",
    });
  });

  it("never shows a stranger's request", () => {
    expect(messagePushText({ ...base, isRequest: true })).toEqual({
      title: "New message request",
      body: "Open UOSBuddy to read it.",
    });
  });

  it("hides the text when previews are off", () => {
    expect(messagePushText({ ...base, previews: false })).toEqual({
      title: "Ali",
      body: "New message",
    });
    expect(
      messagePushText({ ...base, dm: false, chatTitle: "CS 2024", previews: false }).body,
    ).toBe("Ali sent a message");
  });
});
