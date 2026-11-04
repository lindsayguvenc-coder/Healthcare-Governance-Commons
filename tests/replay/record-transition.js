// Records a captioned video of the Transition tools review: Disagreement Unpacker,
// Container Health Check, Charter Builder. The page is real; the AI replies are scripted
// (including hostile and thin ones), so this shows the interface, not live model judgment.
// Usage: from public/, run a static server on 4310, then
//   node record-transition.js http://localhost:4310 ./video-transition
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const base = process.argv[2];
const out = path.resolve(process.argv[3]);
fs.mkdirSync(out, { recursive: true });

const na = "Can't tell from this: nothing here says what either side has lived through.";
const UNPACK = {
  summary: "A timing dispute standing in for a dispute about who carries the risk if the tool is wrong.",
  facts: { party_a: "Burnout is driving departures.", party_b: "The validation data doesn't cover this population." },
  assumptions: { party_a: "Delay has a cost that is being undercounted.", party_b: "Validation evidence so far doesn't fit this population." },
  values: { party_a: "Access now.", party_b: "Not harming the patients least able to absorb an error." },
  experience: { party_a: na, party_b: "Described as having run a prior rollout that was pulled after go-live." },
  incentives: { party_a: "Rewarded for retention numbers.", party_b: "Answers for it if an audit finds a gap." },
  risks: { party_a: "Falling behind while staff burn out.", party_b: "A silent failure nobody is watching for." },
  horizons: { party_a: "This quarter.", party_b: "The next several years of trust." },
  definitions: { party_a: "'Validated' means the vendor tested it.", party_b: "'Validated' means tested on our patients." },
  synthesis: "A limited launch with a named stop owner might honor both, if the group can agree what would trigger a stop.",
  what_we_learned: "Nobody owns the stop decision yet.",
  facilitator_move: "Ask each side what result would change their mind.",
};
const CONTAINER_THIN = {
  overall: "Too little here to say much: only the membership is described.",
  properties: {
    legitimacy: { score: "yellow", finding: "The vendor sits as a voting member." },
    safety: { score: "grey", finding: "Nothing says whether people can disagree safely. Need: what happens after dissent." },
    time: { score: "grey", finding: "Nothing on meeting cadence or pressure." },
    intimacy: { score: "grey", finding: "Nothing on how members work together." },
    narrative: { score: "grey", finding: "Nothing on what story the group tells." },
    stop: { score: "grey", finding: "Nothing says who can pause a tool." },
  },
  active_failure_modes: [],
  recommendations: [{ area: "Vendor seat", action: "Move the vendor to a non-voting seat." }],
};
const CHARTER = `# Dignity before efficiency\n\nNo **workflow** change may shift its error burden onto the "night shift" or the clinic's Medicaid patients. [ASSUMED: the committee covers all three campuses]\n\nIndicator: the group sets a threshold for error rate by shift.\nFailsafe: any member can pause a rollout pending review.\n\nHow to use this draft\n\nDecide the thresholds, cut what doesn't fit, and name owners before adopting anything.`;
const HOSTILE = `<img src=x onerror="window.__pwned=1"> "quoted" and \`backticks\` and \${1+1}`;

let next = null;
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 760 }, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));

  await page.route("**/api/status*", r => r.fulfill({ json: { pausedTools: [], reportsPaused: false } }));
  await page.route("**/api/synthesize", async r => {
    const n = next;
    await new Promise(res => setTimeout(res, 300));
    if (n.status) return r.fulfill({ status: n.status, json: { error: n.error } });
    r.fulfill({ json: { content: [{ type: "text", text: n.text }], stop_reason: n.stop || "end_turn" } });
  });

  const frames = [];
  const caption = async (text, ms = 3200) => {
    await page.evaluate(t => {
      let d = document.getElementById("cap");
      if (!d) { d = document.createElement("div"); d.id = "cap";
        d.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:99999;background:rgba(10,10,20,.92);color:#fff;font:600 19px/1.4 system-ui;padding:14px 22px"; document.body.appendChild(d); }
      d.textContent = t;
    }, text);
    const shot = path.join(out, `frame-${String(frames.length).padStart(3, "0")}.png`);
    await page.screenshot({ path: shot });
    frames.push({ shot, sec: ms / 1000 });
  };
  const to = sel => page.locator(sel).first().scrollIntoViewIfNeeded().then(() => page.evaluate(s => { const e = document.querySelector(s); window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 70); }, sel));
  const results = {};

  await page.goto(`${base}/transition/index.html`);
  await page.waitForTimeout(500);
  results.pausedNote = await page.locator("#report-paused-note").count();

  // 1. Unpacker
  next = { text: JSON.stringify(UNPACK) };
  await page.fill("#disagreement-input", "Half our team wants to launch the AI tool now, half wants more validation.");
  await page.click("#run-btn");
  await page.waitForSelector("#output-content .commons-disclaimer");
  await to("#output-content");
  await caption("Disagreement Unpacker · scripted AI reply, real page");
  const exp = page.locator("#output-content .output-section-label", { hasText: "Lived experience" });
  await exp.evaluate(e => window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 70));
  await caption("Decision 2: lived experience now shows. Decision 3: where it can't tell, it says so, in italics, instead of inventing.", 5000);
  results.unpackerExperience = await exp.count();
  results.cantTell = await page.locator("#output-content .cant-tell").count();
  await to("#output-content .commons-disclaimer");
  await caption("Shared disclaimer, 'written by AI', tool name and version.", 4000);

  // 2. Container, thin
  next = { text: JSON.stringify(CONTAINER_THIN) };
  await page.fill("#container-input", "Our committee has the CMIO, IT, and the vendor.");
  await page.click("#container-btn");
  await page.waitForSelector("#container-output-content .commons-disclaimer");
  await to("#container-output-content");
  await page.evaluate(() => window.scrollBy(0, 120));
  await caption("Container Health Check on a thin description. Decision 1: dashed grey means no result, not a mild concern.", 5500);
  results.greyDots = await page.locator("#container-output-content .health-row .score-grey").count();
  const noClean = page.locator("#container-output-content", { hasText: "isn't a clean result" });
  results.notClean = await noClean.count();
  await page.locator("#container-output-content .output-section-label", { hasText: "Active failure" }).evaluate(e => window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 200));
  await caption("No failure modes found, but it won't call that clean when 5 of 6 weren't assessable.", 5000);

  // 3. Charter, with copy
  next = { text: CHARTER };
  await page.fill("#charter-for-input", "Our clinical AI governance committee");
  await page.click("#charter-btn");
  await page.waitForSelector("#charter-output-content .commons-disclaimer");
  await to("#charter-output-content");
  await caption("Charter Builder. Decision 4: labeled a draft to mark up, assumptions flagged, no raw # or ** symbols.", 5500);
  await page.click("#charter-output-content .copy-btn");
  await page.waitForTimeout(200);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  results.copyHasQuotes = clip.includes('"night shift"');
  results.copyHasDraft = clip.startsWith("DRAFT");
  results.copyHasFooter = clip.includes("Working prototype");
  results.noMarkdown = !(await page.locator(".charter-output").innerText()).match(/\*\*|^#/m);
  await to("#charter-output-content .copy-btn");
  await caption("Copy works even with double quotes in the text, and the copy carries the draft label and disclaimer line.", 4500);

  // 4. Failure paths
  next = { text: HOSTILE };
  await page.click("#charter-btn");
  await page.waitForTimeout(700);
  results.escaped = (await page.evaluate(() => !window.__pwned && !document.querySelector("#charter-output-content img")));
  next = { text: CHARTER, stop: "max_tokens" };
  await page.click("#charter-btn");
  await page.waitForTimeout(700);
  results.cutOffNote = await page.locator("#charter-output-content", { hasText: "cut off" }).count();
  await to("#charter-output-content");
  await caption("If a charter runs out of room, it now says it was cut off.", 3500);
  next = { status: 400, error: "That looks like patient information, so it wasn't sent." };
  await page.fill("#disagreement-input", "test");
  await page.click("#run-btn");
  await page.waitForTimeout(700);
  results.refusalShown = await page.locator("#output-content", { hasText: "patient information" }).count();
  await to("#output-content");
  await caption("Refusals say why now, instead of 'Something went wrong.'", 3500);
  next = { text: JSON.stringify(UNPACK).slice(0, 200), stop: "max_tokens" };
  await page.click("#run-btn");
  await page.waitForTimeout(700);
  results.jsonCutOff = await page.locator("#output-content", { hasText: "cut off" }).count();

  await caption(errors.length ? `Page errors: ${errors.join(" | ")}` : "Done. No page errors. Reminder: these AI replies were scripted.", 3500);
  await browser.close();

  console.log(JSON.stringify({ results, errors }, null, 1));
  const list = path.join(out, "frames.txt");
  fs.writeFileSync(list, frames.map(f => `file '${f.shot}'\nduration ${f.sec}`).join("\n") + `\nfile '${frames.at(-1).shot}'\n`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-vf", "scale=1100:-2,format=yuv420p", "-r", "24", path.join(out, "transition-replay.mp4")]);
})().catch(e => { console.error(e); process.exit(1); });
