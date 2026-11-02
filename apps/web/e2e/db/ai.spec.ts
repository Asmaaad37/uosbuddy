import { expect, test } from "@playwright/test";
import { db, logIn, makeStudent, run, textPdf } from "./helpers";

// Phase 7: AI Buddy answers from a shared PDF with a source; moderation holds or blocks
// posts. CI runs with AI_FAKE=1: Buddy quotes the best match, and [[hold]] / [[block]] in a
// post pick the moderation decision (no Claude calls).
test.skip(!process.env.E2E_DB || !process.env.AI_FAKE, "needs E2E_DB=1 and AI_FAKE=1");

const code = `CS${(Date.now() % 9000) + 1000}`;

test("AI Buddy answers from the course's files, with a source", async ({ browser }) => {
  test.setTimeout(120_000);
  const s = await makeStudent("Hira Aslam", `hira7_${run}`.slice(0, 20), 4);
  const page = await (await browser.newContext()).newPage();
  page.on("pageerror", (e) => console.log("[pageerror]", e.stack));
  page.on("console", (m) => m.type() === "error" && console.log("[console.error]", m.text()));
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

test("moderation blocks rule-breaking posts and holds unsure ones for review", async ({
  browser,
}) => {
  test.skip(!process.env.MODERATION_SECRET, "needs MODERATION_SECRET");
  test.setTimeout(90_000);
  const [a, b] = await Promise.all(
    [
      ["Sana Javed", "sana"],
      ["Usman Ali", "usman"],
    ].map(async ([name, first]) => {
      const s = await makeStudent(name!, `${first}7_${run}`.slice(0, 20), 4);
      const page = await (await browser.newContext()).newPage();
      await logIn(page, s.email, s.password);
      return { page, ...s };
    }),
  );
  const post = async (text: string) => {
    await a!.page.getByRole("button", { name: "Write a post" }).click();
    await a!.page.getByLabel("What's happening?").fill(text);
    await a!.page.getByRole("button", { name: "Post", exact: true }).click();
  };

  await a!.page.goto("/feed?sort=new");
  await post(`[[block]] blocked post ${run}`);
  await expect(a!.page.getByRole("alert")).toContainText("breaks the community rules");
  await a!.page.keyboard.press("Escape");

  await post(`[[hold]] Is the library open late? ${run}`);
  await expect(a!.page.getByText("A moderator will check your post")).toBeVisible();
  const held = a!.page.locator("article", { hasText: `Is the library open late? ${run}` });
  await expect(held.getByText("Under review")).toBeVisible();

  await post(`Anyone up for cricket after class? ${run}`);
  await b!.page.goto("/feed?sort=new");
  await expect(b!.page.getByText(`Anyone up for cricket after class? ${run}`)).toBeVisible();
  await expect(b!.page.getByText(`Is the library open late? ${run}`)).toHaveCount(0);
  await expect(b!.page.getByText(`blocked post ${run}`)).toHaveCount(0);
});

test("a timetable screenshot becomes classes after the student checks them", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const s = await makeStudent("Zain Abbas", `zain7_${run}`.slice(0, 20), 4);
  const page = await (await browser.newContext()).newPage();
  await logIn(page, s.email, s.password);

  await page.goto("/timetable");
  await page.getByLabel("Timetable screenshot").setInputFiles({
    name: "timetable.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      "base64",
    ),
  });

  // The fake reader finds Calculus (Mon 8:30) and Physics lab (Wed 11:00); fix one, drop one.
  const found = page.getByRole("list", { name: "Classes found" });
  await expect(found.getByRole("listitem")).toHaveCount(2);
  const first = found.getByRole("listitem", { name: "Class 1" });
  await expect(first.getByLabel("Class name")).toHaveValue("Calculus");
  await first.getByLabel("Starts").fill("09:00");
  await page.getByRole("button", { name: "Remove Physics lab" }).click();
  await page.screenshot({ path: "test-results/screens/phase-7/02-timetable-import.png" });
  await page.getByRole("button", { name: "Save 1 class" }).click();

  const monday = page.getByRole("region", { name: "Mon" });
  await expect(monday.getByText("Calculus")).toBeVisible();
  await expect(monday.getByText("9:00–10:00")).toBeVisible();
  await expect(page.getByRole("region", { name: "Wed" }).getByText("Physics lab")).toHaveCount(0);
});
