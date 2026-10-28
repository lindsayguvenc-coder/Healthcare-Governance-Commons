// Records the review-queue walkthrough as a video, with a caption bar per step.
// Usage: node record.js <baseUrl> <outDir>
const { chromium } = require("playwright");
const base = process.argv[2];
const out = process.argv[3];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: out, size: { width: 1280, height: 800 } } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));

  const caption = async (text, ms = 2200) => {
    await page.evaluate(t => {
      let el = document.getElementById("__cap");
      if (!el) {
        el = document.createElement("div");
        el.id = "__cap";
        el.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:99999;padding:14px 22px;background:rgba(10,12,20,.94);color:#f5f0ff;font:600 17px/1.4 system-ui,sans-serif;border-top:2px solid #a78bfa";
        document.body.appendChild(el);
      }
      el.textContent = t;
    }, text);
    await page.waitForTimeout(ms);
  };
  const slowType = async (sel, text) => { await page.locator(sel).click(); await page.locator(sel).pressSequentially(text, { delay: 12 }); };
  const toForm = async label => {
    const b = page.getByRole("button", { name: label });
    await b.scrollIntoViewIfNeeded(); await page.waitForTimeout(500); await b.click(); await page.waitForTimeout(400);
  };
  const send = async () => {
    await page.getByRole("button", { name: "Send for review" }).click();
    await page.waitForTimeout(1200);
  };

  // 1 · consensus approve
  await page.goto(`${base}/nodes/stop`); await page.waitForTimeout(800);
  await caption("Test 1 · Stop Mechanisms · a visitor suggests a real FDA source");
  await toForm("Suggest a source");
  await slowType("#c-stop-source-url", "https://www.fda.gov/regulatory-information/search-fda-guidance-documents/marketing-submission-recommendations-predetermined-change-control-plan-artificial-intelligence");
  await slowType("#c-stop-source-text", "FDA's final guidance on pre-authorized model changes, including rollback.");
  await send();
  await caption("Sent. The page says plainly it's waiting for review. Nothing is published yet.", 2600);

  // 2 · consensus reject
  await page.goto(`${base}/nodes/watcher`); await page.waitForTimeout(800);
  await caption("Test 2 · Watcher · a vendor pitch submitted as a tool");
  await toForm("Suggest a tool");
  await slowType("#c-watcher-tool-url", "https://www.example.com/ai-governance-platform");
  await slowType("#c-watcher-tool-text", "Best-in-class AI monitoring, book a demo and get 20% off!");
  await send();
  await caption("Also accepted into the queue. Review decides, not the form.", 2200);

  // 3 · split
  await page.goto(`${base}/nodes/override`); await page.waitForTimeout(800);
  await caption("Test 3 · Human Override · a practice note with a role and an unsourced number");
  await toForm("Add a note");
  await slowType("#c-override-note-text", "In our ED, override rates on the sepsis alert ran above 80%, and nobody reviewed them because no committee owned the alert after go-live.");
  await slowType("#c-override-note-role", "ED charge nurse");
  await page.check("#c-override-note-consent");
  await send();
  await caption("Sent with consent to publish under the role, marked self-described.", 2200);

  // 4 · refused before the queue
  await page.goto(`${base}/nodes/equity`); await page.waitForTimeout(800);
  await caption("Test 4 · Equity · a question that includes a medical record number");
  await toForm("Ask a question");
  await slowType("#c-equity-question-text", "Patient MRN 48213377 was flagged differently than her sister, is that bias?");
  await send();
  await caption("Refused on the spot, with the reason. It never reaches the queue; only a count is kept.", 3200);

  // 5 · the queue
  await page.goto(`${base}/`); await page.waitForTimeout(1000);
  await caption("Lindsay's side · the private Intake tab");
  await page.getByRole("button", { name: /Add Document/ }).first().click(); await page.waitForTimeout(600);
  await page.getByPlaceholder("Password").fill("test");
  await page.getByRole("button", { name: /Unlock/ }).click();
  await caption("Two AI reviewers read each item independently: fit and skeptic.", 2000);
  await page.waitForSelector("text=Both recommend approve", { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.locator("text=REVIEW QUEUE").first().scrollIntoViewIfNeeded();
  await caption("Test 1: both approve. Test 2: both reject as promotional. Test 3: they split.", 4200);

  await page.getByRole("button", { name: /accept consensus · publish/ }).first().scrollIntoViewIfNeeded();
  await caption("Consensus to approve → one click, no explanation needed.", 2000);
  await page.getByRole("button", { name: /accept consensus · publish/ }).first().click(); await page.waitForTimeout(1500);

  await caption("Consensus to reject → one click. The reason (promotional) is recorded.", 2000);
  await page.getByRole("button", { name: /accept consensus · delete/ }).first().click(); await page.waitForTimeout(1500);

  await page.locator("text=Reviewers split. Your call.").scrollIntoViewIfNeeded();
  await caption("Split → Lindsay breaks the tie. Rejecting needs a reason; approving doesn't.", 3200);
  await page.getByRole("button", { name: "approve · publish" }).first().click(); await page.waitForTimeout(1500);

  await page.locator("text=RECORD FOR THE AUTO-APPROVAL DECISION").scrollIntoViewIfNeeded();
  await caption("The record builds itself: agreement, overrides, which reviewer she sided with, refusals.", 4200);

  // 6 · published
  await page.goto(`${base}/nodes/stop`); await page.waitForTimeout(1000);
  await page.locator("text=contributed · reviewed").first().scrollIntoViewIfNeeded();
  await caption("Back on Stop Mechanisms: the FDA source is live, marked contributed · reviewed.", 3200);
  await page.goto(`${base}/nodes/override`); await page.waitForTimeout(1000);
  await page.locator("text=self-described").first().scrollIntoViewIfNeeded();
  await caption("And the nurse's note, credited as self-described. End of replay.", 3200);

  await ctx.close(); await browser.close();
  console.log("errors:", JSON.stringify(errors));
})().catch(e => { console.error(e); process.exit(1); });
