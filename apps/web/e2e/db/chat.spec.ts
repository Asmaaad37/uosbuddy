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

// TEMP diagnostics: print console output, and if the page stops responding, pause V8 and
// print where it is stuck.
function watch(page: Page, label: string) {
  page.on("console", (m) => console.log(`[${label} console] ${m.type()}: ${m.text()}`));
  page.on("pageerror", (e) => console.log(`[${label} pageerror] ${e.message}`));
}
async function assertResponsive(page: Page, label: string) {
  const alive = await Promise.race([
    page.evaluate(() => true).catch(() => false),
    new Promise<boolean>((r) => setTimeout(() => r(false), 5000)),
  ]);
  if (alive) return;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Debugger.enable");
  const paused = new Promise<{
    callFrames: {
      functionName: string;
      url: string;
      location: { scriptId: string; lineNumber: number; columnNumber: number };
    }[];
  }>((r) => cdp.once("Debugger.paused", r as never));
  await cdp.send("Debugger.pause");
  const { callFrames } = await paused;
  for (const f of callFrames.slice(0, 12)) {
    const { scriptSource } = await cdp.send("Debugger.getScriptSource", {
      scriptId: f.location.scriptId,
    });
    const line = scriptSource.split("\n")[f.location.lineNumber] ?? "";
    const c = f.location.columnNumber;
    console.log(
      `[${label} stuck] ${f.functionName || "(anon)"} ${f.url}:${f.location.lineNumber}:${c} …${line.slice(Math.max(0, c - 120), c + 120)}…`,
    );
  }
  throw new Error(`${label} page is not responding`);
}

test("two students connect and chat in realtime", async ({ browser }) => {
  test.setTimeout(120_000);
  const [a, aHandle] = await student(browser, "Areeba Malik", "areeba");
  const [b, bHandle] = await student(browser, "Bilal Raza", "bilal");
  watch(a, "A");
  watch(b, "B");

  // A asks to connect, answering B's Opening Move.
  await a.goto(`/people/${bHandle}`);
  await a.getByRole("button", { name: "Connect" }).click();
  await expect(a.getByText("The dhaba behind the main gate, no contest.").last()).toBeVisible();
  await a.getByLabel("Your reply (optional)").fill("Same! See you there after class");
  await a.getByRole("button", { name: "Send request" }).click();
  await expect(a.getByRole("button", { name: "Requested" })).toBeVisible();

  // B accepts from Requests.
  await b.goto("/chats?tab=requests");
  await expect(b.getByText("Same! See you there after class")).toBeVisible();
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

  // A → B, timed.
  await a.getByLabel("Message", { exact: true }).fill("Salam! Chai at 3?");
  await assertResponsive(a, "A");
  const sentAt = Date.now();
  await a.getByLabel("Message", { exact: true }).press("Enter");
  await expect(b.getByText("Salam! Chai at 3?")).toBeVisible({ timeout: 5_000 });
  const deliveryMs = Date.now() - sentAt;
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

  // The chats list shows the conversation with B's last message for A.
  await a.goto("/chats");
  await expect(a.getByText("Bilal Raza")).toBeVisible();

  // B blocks A: the chat disappears from A's list and A's profile is gone for B.
  await b.goto(`/people/${aHandle}`);
  await b.getByRole("button", { name: "More" }).click();
  await b.getByRole("menuitem", { name: "Block" }).click();
  await b.getByRole("button", { name: "Block" }).click();
  await a.goto("/chats");
  await expect(a.getByText("Bilal Raza")).toHaveCount(0);
});
