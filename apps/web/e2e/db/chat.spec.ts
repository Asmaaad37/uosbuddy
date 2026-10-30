import { expect, test, type Browser, type Page } from "@playwright/test";
import { logIn, makeStudent, run } from "./helpers";

// Phase 4: two students in two browsers, connecting and chatting in realtime.
test.skip(!process.env.E2E_DB, "needs a local Supabase stack (E2E_DB=1)");

// A tiny PNG, enough to exercise compression, upload and the signed link.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

async function student(browser: Browser, name: string, first: string): Promise<[Page, string]> {
  const s = await makeStudent(name, `${first}4_${run}`.slice(0, 20), 4);
  const page = await (await browser.newContext()).newPage();
  await logIn(page, s.email, s.password);
  return [page, s.handle];
}

const liveLog = (page: Page) => page.locator('[role="log"][data-live]');

test("two students connect and chat in realtime", async ({ browser }) => {
  test.setTimeout(120_000);
  const [a, aHandle] = await student(browser, "Areeba Malik", "areeba");
  const [b, bHandle] = await student(browser, "Bilal Raza", "bilal");

  // A asks to connect, answering B's Opening Move.
  await a.goto(`/people/${bHandle}`);
  await a.getByRole("button", { name: "Connect" }).click();
  await expect(a.getByText("The dhaba behind the main gate, no contest.").last()).toBeVisible();
  await a.getByLabel("Your reply (optional)").fill("Same! See you there after class");
  await a.screenshot({ path: "test-results/screens/phase-4/01-connect-sheet-1280.png" });
  await a.getByRole("button", { name: "Send request" }).click();
  await expect(a.getByRole("button", { name: "Requested" })).toBeVisible();

  // B accepts from Requests.
  await b.goto("/chats?tab=requests");
  await expect(b.getByText("Same! See you there after class")).toBeVisible();
  await b.screenshot({ path: "test-results/screens/phase-4/02-requests-1280.png" });
  await b.getByRole("button", { name: "Accept" }).click();
  await expect(b.getByText(/Connected!/)).toBeVisible();

  // A opens the chat; B opens it from the profile too. Both wait until realtime is live.
  await a.goto(`/people/${bHandle}`);
  await a.getByRole("button", { name: "Message" }).click();
  await expect(a).toHaveURL(/\/chats\/[0-9a-f-]{36}$/);
  const chatUrl = a.url();
  await b.goto(chatUrl);
  await expect(liveLog(a)).toBeVisible({ timeout: 30_000 });
  await expect(liveLog(b)).toBeVisible({ timeout: 30_000 });

  // A → B, timed in the browsers (same machine clock): Enter on A to the text on B's screen.
  const text = "Salam! Chai at 3?";
  await b.evaluate((t) => {
    const w = window as unknown as { __seenAt?: number };
    new MutationObserver((_, obs) => {
      if (document.body.innerText.includes(t)) {
        w.__seenAt = Date.now();
        obs.disconnect();
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }, text);
  await a.getByLabel("Message", { exact: true }).fill(text);
  const sentAt = await a.evaluate(() => Date.now());
  await a.getByLabel("Message", { exact: true }).press("Enter");
  await expect(b.getByText(text)).toBeVisible({ timeout: 5_000 });
  const seenAt = await b.evaluate(() => (window as unknown as { __seenAt?: number }).__seenAt ?? 0);
  const deliveryMs = seenAt - sentAt;
  console.log(`[chat] A → B delivered in ${deliveryMs} ms`);
  test.info().annotations.push({ type: "delivery-ms", description: String(deliveryMs) });

  // B is seen typing, then replies; A sees "Seen" once B has read A's message.
  await b.getByLabel("Message", { exact: true }).pressSequentially("Done", { delay: 50 });
  await expect(a.getByText(/is typing/)).toBeVisible({ timeout: 5_000 });
  await b.getByLabel("Message", { exact: true }).press("Enter");
  await expect(a.getByText("Done", { exact: true })).toBeVisible({ timeout: 5_000 });
  await a.getByLabel("Message", { exact: true }).fill("See you!");
  await a.getByLabel("Message", { exact: true }).press("Enter");
  await expect(a.getByText("Seen")).toBeVisible({ timeout: 10_000 });

  // A sends a photo; B sees it.
  await a.locator('input[type="file"]').setInputFiles({
    name: "chai.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await expect(b.getByRole("img", { name: "Photo" })).toBeVisible({ timeout: 10_000 });

  // Screenshots (phone width) of the conversation from B's side.
  const shot = async (page: Page, name: string) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({ path: `test-results/screens/phase-4/${name}-375.png` });
  };
  await shot(b, "03-conversation");

  // A makes a group with B; B finds it under Groups and joins the batch chat too.
  await a.goto("/chats/new");
  await a.getByLabel("Group name").fill("DSA study group");
  await a.getByRole("checkbox", { name: /Bilal Raza/ }).click();
  await shot(a, "04-new-group");
  await a.getByRole("button", { name: "Create group" }).click();
  await expect(a).toHaveURL(/\/chats\/[0-9a-f-]{36}$/);
  await expect(a.getByText("2 members")).toBeVisible();
  await b.goto("/chats?tab=groups");
  await expect(b.getByText("DSA study group")).toBeVisible();
  await shot(b, "05-groups");
  await b.getByRole("button", { name: "Join" }).first().click();
  await expect(b).toHaveURL(/\/chats\/[0-9a-f-]{36}$/);
  await expect(b.getByText("CS 2024", { exact: true })).toBeVisible();

  // The chats list shows the conversation with B's last message for A.
  await a.goto("/chats");
  await expect(a.getByText("Bilal Raza")).toBeVisible();
  await shot(a, "06-chats");

  // B blocks A: the chat disappears from A's list and A's profile is gone for B.
  await b.goto(`/people/${aHandle}`);
  await b.getByRole("button", { name: "More" }).click();
  await b.getByRole("menuitem", { name: "Block" }).click();
  await b.getByRole("button", { name: "Block" }).click();
  await a.goto("/chats");
  await expect(a.getByText("Bilal Raza")).toHaveCount(0);
});
