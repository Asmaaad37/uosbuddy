import { describe, expect, it } from "vitest";
import { checkDigestToken, digestToken } from "./digest";

describe("digest unsubscribe tokens", () => {
  it("accept only the token made for that student with that secret", () => {
    const t = digestToken("user-1", "s3cret");
    expect(checkDigestToken("user-1", t, "s3cret")).toBe(true);
    expect(checkDigestToken("user-2", t, "s3cret")).toBe(false);
    expect(checkDigestToken("user-1", t, "other")).toBe(false);
    expect(checkDigestToken("user-1", "short", "s3cret")).toBe(false);
  });
});
