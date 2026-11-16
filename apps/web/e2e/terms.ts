import type { Page } from "@playwright/test";
import { TERMS_COOKIE, TERMS_VERSION } from "../lib/terms";

/** What ticking "I agree" on the first sign-up screen leaves behind, for tests that skip it. */
export async function agreeToTerms(page: Page, baseURL: string | undefined) {
  await page
    .context()
    .addCookies([{ name: TERMS_COOKIE, value: TERMS_VERSION, url: baseURL ?? "http://localhost" }]);
}
