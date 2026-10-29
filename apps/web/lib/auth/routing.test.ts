import { describe, expect, it } from "vitest";
import { homePath, redirectFor, safeNext, type RoutingProfile } from "./routing";

const profile = (
  verification_status: RoutingProfile["verification_status"],
  extra: Partial<RoutingProfile> = {},
): RoutingProfile => ({ verification_status, onboarding_step: 0, role: "student", ...extra });

describe("homePath", () => {
  it("routes each verification state to its home", () => {
    expect(homePath(null)).toBe("/");
    expect(homePath(profile("unverified"))).toBe("/start/freshman/proof");
    expect(homePath(profile("pending"))).toBe("/pending");
    expect(homePath(profile("needs_info"))).toBe("/pending");
    expect(homePath(profile("rejected"))).toBe("/pending");
    expect(homePath(profile("verified"))).toBe("/setup");
    expect(homePath(profile("verified", { onboarding_step: 4 }))).toBe("/explore");
  });
});

describe("redirectFor", () => {
  it("lets visitors browse public pages and sends them to log in elsewhere", () => {
    expect(redirectFor("/", false, null)).toBeNull();
    expect(redirectFor("/start/campus", false, null)).toBeNull();
    expect(redirectFor("/design", false, null)).toBeNull();
    expect(redirectFor("/pending", false, null)).toBe("/login?next=%2Fpending");
    expect(redirectFor("/start/freshman/proof", false, null)).toBe(
      "/login?next=%2Fstart%2Ffreshman%2Fproof",
    );
  });

  it("sends signed-in users away from sign-up pages", () => {
    expect(redirectFor("/", true, profile("verified"))).toBe("/setup");
    expect(redirectFor("/login", true, profile("pending"))).toBe("/pending");
  });

  it("keeps each state on the pages it may use", () => {
    expect(redirectFor("/explore", true, profile("pending"))).toBe("/pending");
    expect(redirectFor("/start/freshman/proof", true, profile("needs_info"))).toBeNull();
    expect(redirectFor("/pending", true, profile("verified"))).toBe("/setup");
    expect(redirectFor("/setup", true, profile("verified"))).toBeNull();
    expect(redirectFor("/pending", true, profile("unverified"))).toBe("/start/freshman/proof");
  });

  it("shows profiles only to signed-in, verified students", () => {
    expect(redirectFor("/people/sana_k", false, null)).toBe("/login?next=%2Fpeople%2Fsana_k");
    expect(redirectFor("/people/sana_k", true, profile("pending"))).toBe("/pending");
    expect(redirectFor("/people/sana_k", true, profile("verified"))).toBeNull();
  });

  it("keeps non-admins out of /admin", () => {
    expect(redirectFor("/admin/verifications", true, profile("verified"))).toBe("/setup");
    expect(
      redirectFor("/admin/verifications", true, profile("verified", { role: "admin" })),
    ).toBeNull();
  });

  it("never redirects to the page being requested", () => {
    expect(redirectFor("/", true, null)).toBeNull();
  });
});

describe("safeNext", () => {
  it("accepts only same-site paths", () => {
    expect(safeNext("/setup")).toBe("/setup");
    expect(safeNext("//evil.example")).toBeNull();
    expect(safeNext("/\\evil.example")).toBeNull();
    expect(safeNext("https://evil.example")).toBeNull();
    expect(safeNext(null)).toBeNull();
  });
});
