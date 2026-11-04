import { expect, test, type Browser, type Page } from "@playwright/test";
import { db, logIn, makeStudent, run } from "./helpers";

// Phase 8: a ride from offer to cancellation (women-only rides stay hidden), a market
// listing from post to "sold", and a society from sign-up to an event with RSVPs.
test.skip(!process.env.E2E_DB, "needs a local Supabase stack (E2E_DB=1)");

async function student(
  browser: Browser,
  name: string,
  first: string,
  extra: Record<string, unknown> = {},
) {
  const s = await makeStudent(name, `${first}8_${run}`.slice(0, 20), 4, extra);
  const page = await (await browser.newContext()).newPage();
  await logIn(page, s.email, s.password);
  return { page, ...s };
}

const shot = (page: Page, name: string) =>
  page.screenshot({ path: `test-results/screens/phase-8/${name}.png`, fullPage: true });

test("a ride: offer, ask, accept into a chat, leave, cancel; women-only stays hidden", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const [driver, rider, woman] = await Promise.all([
    student(browser, "Faizan Akhtar", "faizan"),
    student(browser, "Hamza Iqbal", "hamza"),
    student(browser, "Mehwish Tariq", "mehwish"),
  ]);
  const to = `Bhalwal ${run}`;

  // The driver offers one seat.
  await driver.page.goto("/rides");
  await driver.page.getByRole("button", { name: "Offer or ask for a ride" }).click();
  await driver.page.getByLabel("From", { exact: true }).fill("UoS main gate");
  await driver.page.getByLabel("To", { exact: true }).fill(to);
  await driver.page.getByLabel("Seats").selectOption("1");
  await driver.page.getByLabel("Notes (optional)").fill("Leaving after the 3 pm class");
  await shot(driver.page, "01-new-ride");
  await driver.page.getByRole("button", { name: "Post ride" }).click();
  await expect(driver.page).toHaveURL(/\/rides\?tab=mine$/);
  await expect(driver.page.getByText(to)).toBeVisible();

  // A confirmed woman posts a women-only ride; the rider never sees it.
  await db().from("women_only_access").insert({ user_id: woman.id, status: "approved" });
  await woman.page.goto("/rides");
  await woman.page.getByRole("button", { name: "Offer or ask for a ride" }).click();
  await woman.page.getByLabel("From", { exact: true }).fill("UoS hostels");
  await woman.page.getByLabel("To", { exact: true }).fill(`Shahpur ${run}`);
  await woman.page.getByRole("checkbox", { name: /Women only/ }).check();
  await woman.page.getByRole("button", { name: "Post ride" }).click();
  await expect(
    woman.page
      .getByRole("listitem")
      .filter({ hasText: `Shahpur ${run}` })
      .getByText("Women only", { exact: true }),
  ).toBeVisible();

  // The rider asks for the seat.
  await rider.page.goto("/rides");
  await expect(rider.page.getByText(`Shahpur ${run}`)).toHaveCount(0);
  const card = rider.page.getByRole("listitem").filter({ hasText: to });
  await card.getByRole("button", { name: "Ask for a seat" }).click();
  await expect(card.getByText("Waiting for an answer")).toBeVisible();
  await shot(rider.page, "02-rides-board");

  // The driver accepts; the ride fills and both get the ride chat.
  await driver.page.reload();
  const mine = driver.page.getByRole("listitem").filter({ hasText: to }).first();
  await mine.getByRole("button", { name: "Seat requests" }).click();
  await mine
    .getByRole("list", { name: "Requests" })
    .getByRole("button", { name: "Accept" })
    .click();
  await expect(mine.getByText("In the ride")).toBeVisible();
  await expect(mine.getByText("Full")).toBeVisible();
  await rider.page.goto("/rides?tab=mine");
  await rider.page.getByRole("link", { name: "Ride chat" }).click();
  await expect(rider.page).toHaveURL(/\/chats\/[0-9a-f-]{36}$/);
  await expect(rider.page.getByText(`Ride: UoS main gate → ${to}`).first()).toBeVisible();
  await rider.page.getByRole("textbox", { name: "Message" }).fill("Where exactly do we meet?");
  await rider.page.keyboard.press("Enter");
  await expect(rider.page.getByText("Where exactly do we meet?")).toBeVisible();

  // The rider leaves: the seat opens again. Then the driver cancels.
  await rider.page.goto("/rides?tab=mine");
  await rider.page.getByRole("button", { name: "Leave ride" }).click();
  // Saved once the ride drops off the rider's list; only then look as the driver.
  await expect(rider.page.getByText(to)).toHaveCount(0);
  await driver.page.reload();
  const again = driver.page.getByRole("listitem").filter({ hasText: to }).first();
  await expect(again.getByText("1 of 1 seats left")).toBeVisible();
  await again.getByRole("button", { name: "Cancel ride" }).click();
  await expect(again.getByText("Cancelled")).toBeVisible();
  const { data: notes } = await db()
    .from("notifications")
    .select("type")
    .eq("user_id", driver.id)
    .order("created_at");
  expect(notes?.map((n) => n.type)).toEqual(expect.arrayContaining(["ride.request", "ride.left"]));
});

test("market: post with a price, find it, message the seller, mark sold", async ({ browser }) => {
  test.setTimeout(120_000);
  const [seller, buyer] = await Promise.all([
    student(browser, "Iqra Shafiq", "iqra"),
    student(browser, "Bilal Hassan", "bilal"),
  ]);
  const title = `Casio fx-991ES ${run}`;

  await seller.page.goto("/market");
  await seller.page.getByRole("button", { name: "Post a listing" }).click();
  await seller.page.getByLabel("Title").fill(title);
  await seller.page.getByLabel("Details (optional)").fill("Like new, with cover");
  await seller.page.getByLabel("Price (Rs)").fill("2500");
  await seller.page.getByLabel("Where (optional)").fill("Main library");
  await seller.page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(seller.page.getByRole("article", { name: title })).toBeVisible();

  await buyer.page.goto("/market");
  await buyer.page.getByLabel("Search the market").fill(`fx-991ES ${run}`);
  await buyer.page.keyboard.press("Enter");
  const listing = buyer.page.getByRole("article", { name: title });
  await expect(listing.getByText("Rs 2,500")).toBeVisible();
  await shot(buyer.page, "03-market");
  await listing.getByRole("button", { name: "Message" }).click();
  await expect(buyer.page).toHaveURL(/\/chats\/[0-9a-f-]{36}\?draft=/);
  await expect(buyer.page.getByRole("textbox", { name: "Message" })).toHaveValue(
    `Hi! About "${title}"…`,
  );

  await seller.page.reload();
  await seller.page
    .getByRole("article", { name: title })
    .getByRole("button", { name: "Mark sold" })
    .click();
  await expect(seller.page.getByRole("article", { name: title }).getByText("Sold")).toBeVisible();
});

test("a society is verified, posts an event, and students RSVP", async ({ browser }) => {
  test.setTimeout(150_000);
  const [lead, admin, fan] = await Promise.all([
    student(browser, "Zoya Malik", "zoya"),
    student(browser, "Admin Eight", "admin", { role: "admin" }),
    student(browser, "Saad Anwar", "saad"),
  ]);
  const slug = `debate-${run}`;

  await lead.page.goto("/events?tab=societies");
  await lead.page.getByRole("button", { name: "Start a society page" }).click();
  await lead.page.getByLabel("Emoji").fill("🎤");
  await lead.page.getByLabel("Society name").fill(`Debating ${run}`);
  await lead.page.getByLabel("Web address").fill(slug);
  await lead.page.getByLabel("About").fill("We argue, politely.");
  await lead.page.getByRole("button", { name: "Send for verification" }).click();
  await expect(lead.page).toHaveURL(new RegExp(`/events/s/${slug}$`));
  await expect(lead.page.getByText("Awaiting an admin check")).toBeVisible();

  // Hidden from other students until an admin verifies it.
  await fan.page.goto("/events?tab=societies");
  await expect(fan.page.getByText(`Debating ${run}`)).toHaveCount(0);
  await admin.page.goto("/admin/campus");
  await admin.page.getByRole("button", { name: `Approve Debating ${run}` }).click();
  await expect(admin.page.getByText(`Debating ${run}`)).toHaveCount(0);

  // The society posts an event with room for one.
  await lead.page.reload();
  await lead.page.getByRole("button", { name: "Post an event" }).click();
  await lead.page.getByLabel("Event name").fill(`Open debate ${run}`);
  await lead.page.getByLabel("Venue").fill("Hall A");
  await lead.page.getByLabel("Capacity").fill("1");
  await lead.page.getByRole("button", { name: "Post event" }).click();
  await expect(lead.page.getByRole("article", { name: `Open debate ${run}` })).toBeVisible();

  await fan.page.goto("/events");
  const event = fan.page.getByRole("article", { name: `Open debate ${run}` });
  await event.getByRole("button", { name: "Going" }).click();
  await expect(event.getByText("1 going of 1")).toBeVisible();
  await shot(fan.page, "04-events");
  const href = await event.getByRole("link", { name: "Add to calendar" }).getAttribute("href");
  const ics = await fan.page.request.get(href!);
  expect(ics.headers()["content-type"]).toContain("text/calendar");
  expect(await ics.text()).toContain(`SUMMARY:Open debate ${run}`);

  // Full: someone else can only be interested.
  await admin.page.goto("/events");
  const full = admin.page.getByRole("article", { name: `Open debate ${run}` });
  await expect(full.getByRole("button", { name: "Full" })).toBeDisabled();
  await full.getByRole("button", { name: "Interested" }).click();
  await expect(full.getByText("1 interested")).toBeVisible();
});
