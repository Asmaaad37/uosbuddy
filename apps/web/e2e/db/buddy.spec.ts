import { expect, test } from "@playwright/test";
import { db, logIn, makeStudent, run, textPdf } from "./helpers";

// Phase 7: a shared PDF is indexed, and AI Buddy answers from it with a source. CI runs with
// AI_FAKE=1, so the answer is a canned quote of the best match (no Claude call).
test.skip(!process.env.E2E_DB || !process.env.AI_FAKE, "needs E2E_DB=1 and AI_FAKE=1");

const code = `CS${(Date.now() % 9000) + 1000}`;

test("AI Buddy answers from the course's files, with a source", async ({ browser }) => {
  test.setTimeout(120_000);
  const s = await makeStudent("Hira Aslam", `hira7_${run}`.slice(0, 20), 4);
  const page = await (await browser.newContext()).newPage();
  await logIn(page, s.email, s.password);

  // No courses yet: Buddy points to adding one.
  await page.goto("/buddy");
  await expect(page.getByRole("link", { name: "Add your courses" })).toBeVisible();

  await page.goto("/courses");
  await page.getByRole("button", { name: "Add a course" }).click();
  await page.getByPlaceholder("CS-301 or Data Structures").fill(code);
  await page.getByRole("button", { name: "Can't find it? Add it" }).click();
  await page.getByLabel("Course title").fill("Algorithms");
  await page.getByRole("button", { name: "Add and join" }).click();
  await expect(page).toHaveURL(/\/courses\/[0-9a-f-]{36}$/);

  const courseUrl = page.url();

  // No files yet: an honest "I don't know", with no model call and no sources.
  await page.goto("/buddy");
  await expect(page.getByText("30 of 30 questions left today")).toBeVisible();
  await page.getByLabel("Ask AI Buddy").fill("What is a binary heap?");
  await page.getByRole("button", { name: "Ask" }).click();
  const chat = page.getByRole("log", { name: "AI Buddy chat" });
  await expect(chat.getByText(/I don't know from your course materials/)).toBeVisible();
  await expect(chat.getByRole("list", { name: "Sources" })).toHaveCount(0);

  await page.goto(courseUrl);
  await page.getByRole("button", { name: "Share a file" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "sorting-notes.pdf",
    mimeType: "application/pdf",
    buffer: textPdf([
      "Week 3: Sorting algorithms.",
      "Merge sort splits the list in half, sorts each half recursively,",
      "then merges the two sorted halves. It always runs in O(n log n) time",
      "and needs O(n) extra memory for merging.",
      "Quick sort picks a pivot and partitions the list around it.",
    ]),
  });
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(page.getByText("sorting-notes")).toBeVisible();

  // Indexing runs after the response; wait for it.
  await expect
    .poll(
      async () => {
        const { data } = await db()
          .from("resources")
          .select("index_status, chunk_count")
          .eq("uploader_id", s.id)
          .maybeSingle();
        return data?.index_status;
      },
      { timeout: 30_000 },
    )
    .toBe("indexed");

  await page.goto("/buddy");
  await expect(page.getByText("29 of 30 questions left today")).toBeVisible();
  await page.getByLabel("Ask AI Buddy").fill("How much memory does merge sort need?");
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(chat.getByText(/From your course files: [\s\S]*Merge sort/)).toBeVisible();
  const source = chat.getByRole("list", { name: "Sources" }).getByRole("link");
  await expect(source).toContainText("sorting-notes");
  await expect(page.getByText("28 of 30 questions left today")).toBeVisible();
  await expect(page).toHaveURL(/\/buddy\?thread=[0-9a-f-]{36}$/);
  await page.screenshot({ path: "test-results/screens/phase-7/01-buddy.png", fullPage: true });

  // The chat is saved and listed.
  await page.reload();
  await expect(chat.getByText("How much memory does merge sort need?")).toBeVisible();
  const past = page.getByRole("region", { name: "Past chats" });
  await expect(
    past.getByRole("link", { name: /How much memory does merge sort need/ }),
  ).toBeVisible();
  await expect(past.getByRole("link", { name: /What is a binary heap/ })).toBeVisible();

  // The source opens the course's files at that file.
  await chat.getByRole("list", { name: "Sources" }).getByRole("link").first().click();
  await expect(page).toHaveURL(/\/courses\/[0-9a-f-]{36}#r-[0-9a-f-]{36}$/);
});
