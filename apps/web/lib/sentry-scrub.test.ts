import { describe, expect, it } from "vitest";
import { scrubEvent } from "./sentry-scrub";

describe("scrubEvent", () => {
  it("drops bodies, cookies, query strings and all headers but the user agent", () => {
    const e = scrubEvent({
      request: {
        url: "https://x.test/chats/1?invite=abc",
        data: { body: "hi" },
        cookies: { "sb-access-token": "t" },
        query_string: "invite=abc",
        headers: { cookie: "sb=t", authorization: "Bearer t", "user-agent": "UA" },
      },
    });
    expect(e.request).toEqual({ url: "https://x.test/chats/1", headers: { "user-agent": "UA" } });
  });

  it("keeps only the user's id", () => {
    expect(scrubEvent({ user: { id: "u1", email: "a@b.c", ip_address: "1.2.3.4" } }).user).toEqual({
      id: "u1",
    });
    expect(scrubEvent({ user: { email: "a@b.c" } }).user).toEqual({});
  });
});
