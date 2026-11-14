// Records a captioned video of the ROI Assessment content review (Nov 13, 2026).
// The page is real; the AI replies are scripted (including a thinking block first,
// a cut-off reply, a hostile one, and one that sneaks in recommendations it wasn't
// asked for), so this shows the interface and the rules, not live model judgment.
// Usage: from public/, run a static server on 4310, then
//   node record-roi.js http://localhost:4310 ./video-roi [path-to-chrome]
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const base = process.argv[2];
const out = path.resolve(process.argv[3]);
const chrome = process.argv[4];
fs.mkdirSync(out, { recursive: true });

const dim = (summary, strengths, gaps) => ({ summary, strengths, gaps });
const GOOD = {
  dimensions: {
    clinical: dim("Clinical value was measured locally and the result questioned it.", ["A local measurement exists."], ["What the measurement found, in numbers."]),
    operational: dim("Documentation time saved was measured locally from EHR audit logs.", ["Local time data."], ["Whether time saved went to patients or to more visits."]),
    financial: dim("A partial analysis exists, but it leaves out the cost of checking the tool.", [], ["Monitoring and note-review time in the cost."]),
    equity: dim("No subgroup analysis yet, and harm is watched informally.", [], ["Note accuracy for patients with limited English."]),
    community: dim("Can't tell from these answers.", [], ["Whether patients are comfortable being recorded."]),
    nonmonetary: dim("Clinician trust is described as mixed.", [], ["A staff survey instead of an impression."]),
  },
  overallNarrative: "The time savings are real and measured, but the value case is gross, not net, and nobody has checked whether the notes are equally accurate for every patient group.",
  recommendations: [
    "Patient safety: start a monthly sample review of AI-drafted notes before scaling.",
    "Support and retain staff: count note-review time in the cost so the savings figure is net.",
    "Advance health equity: check note accuracy for patients with limited English first.",
  ],
};
const SNEAKY = { ...GOOD, recommendations: ["Scale it to every clinic next month."] };
const HOSTILE = {
  ...GOOD,
  overallNarrative: `<img src=x onerror="window.__pwned=1"> "quoted" and \`backticks\` and \${1+1}`,
};

let next = null;
(async () => {
  const browser = await chromium.launch(chrome ? { executablePath: chrome } : {});
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 760 }, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  const sent = [];

  await page.route("**/api/status*", r => r.fulfill({ json: { pausedTools: [], reportsPaused: false } }));
  await page.route("**/api/synthesize", async r => {
    sent.push(JSON.parse(r.request().postData()));
    const n = next;
    await new Promise(res => setTimeout(res, 300));
    if (n.status) return r.fulfill({ status: n.status, json: { error: n.error } });
    const content = [];
    if (n.thinking) content.push({ type: "thinking", thinking: "Let me look at the answers..." });
    content.push({ type: "text", text: n.text });
    r.fulfill({ json: { content, stop_reason: n.stop || "end_turn" } });
  });

  const frames = [];
  const caption = async (text, ms = 3400) => {
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
  const scrollTo = async (sel) => {
    await page.evaluate(s => {
      const e = document.querySelector(s);
      const c = document.getElementById("content");
      if (e && c) c.scrollTop = e.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop - 20;
      if (e) e.scrollIntoView({ block: "start" });
    }, sel);
    await page.waitForTimeout(150);
  };
  const results = {};

  // Answers for a deployed ambient scribe, applied straight to the page's state.
  const SCRIBE = {
    q_pathway: "Ongoing — system is deployed, assessing value or continuation",
    q_system: "Example Ambient Scribe", q_use_type: "Documentation / generative drafting — produces text a clinician reviews before use",
    q_setting: "Outpatient / ambulatory", q_role: "Governance or AI oversight committee", q_org: "Example Community Health",
    q_deployment_duration: "6–12 months",
    q_strategy: "Yes — documented and in active use",
    q_strategy_priorities: ["Improve patient safety", "Support and retain staff", "Advance health equity"],
    q_roi_defined: "Yes — defined but informally", q_exit_threshold: "Not yet defined",
    q_clinical_expected: ["Improved clinical documentation quality"], q_clinical_status: "Formally measured with local data",
    q_clinical_result: "Value questioned",
    q_operational_expected: ["Reduced workflow time", "Reduced clinician cognitive burden"],
    q_operational_status: "Yes — informal feedback collected", q_alert_fatigue: "Not applicable — system does not generate alerts",
    q_alert_rate: "Not applicable — system does not alert or flag", q_override_rate: "Not tracked",
    q_scribe_time: "Measured locally", q_scribe_quality: "Clinicians edit, but no structured review", q_scribe_consent: "Verbal or informal",
    q_cost: "$150,000 – $500,000", q_assurance_cost: "No — not included",
    q_financial_categories: ["Avoided staff turnover costs — tool provides workflow relief"], q_financial_analysis: "Yes — partial analysis",
    q_equity_relevant: "Yes — high relevance", q_equity_analysis: "No — not yet conducted", q_harm_tracked: "Yes — informally monitored",
    q_community_trust: "No — not assessed", q_community_impact: "Not yet assessed",
    q_staff_trust: "Mixed — divided response", q_patient_trust: "Unknown — not assessed",
    q_evidence_overall: "Strong — robust data across multiple dimensions",
    q_recheck: "Re-check date set, no payoff date", q_baseline: "No", q_adoption: "About half",
    q_time_went: ["More patient visits"], q_check_hours: "Not tracked", q_check_who: ["The clinicians using it"],
    q_coding_source: "Yes — a main part", q_coding_audit: "Spot checks", q_coding_review: "No — codes go out without clinician review",
    q_coding_patient: "No", q_exit_cost: "High — locked in (long contract, data, retraining)", q_alternatives: "No",
    q_burnout_measured: "Yes — before and after",
  };
  const load = async (answers) => {
    await page.goto(`${base}/roi-assessment/index.html`);
    await page.waitForTimeout(300);
    await page.evaluate(ans => { state.answers = JSON.parse(JSON.stringify(ans)); state.phase = "elicit"; state.sectionIdx = 5; }, answers);
  };
  const generate = async (reply) => {
    next = reply;
    await page.evaluate(() => goToGenerate());
    await page.waitForSelector(".report-phase, .error-phase", { timeout: 10000 });
    await page.waitForTimeout(300);
  };

  // 1. Intro and the required check
  await page.goto(`${base}/roi-assessment/index.html`);
  await page.waitForTimeout(400);
  await caption("ROI Assessment, after the Nov 13 review. New intro: no unsourced 'no framework exists' claim, and it says answers go to an AI.");
  await page.click(".start-btn");
  await page.waitForTimeout(200);
  await page.click(".nav-btn-primary");
  await page.waitForTimeout(200);
  results.requiredBlocked = await page.locator("#missing-note").count();
  await caption("Skipping required questions used to work. Now Next stops and outlines what's blank. 'Unknown' counts as an answer.");

  // 2. Typing no longer throws the cursor out
  await page.click("#q-q_system");
  await page.keyboard.type("Example Ambient Scribe", { delay: 25 });
  results.typed = await page.inputValue("#q-q_system");
  await caption(`Typing used to lose the cursor after one letter (the section re-drew on every keystroke). Typed: "${results.typed}".`);
  await page.selectOption("#q-q_use_type", { index: 8 });
  await page.waitForTimeout(200);
  await caption("New use types: ambient scribe, agentic workflow, administrative. Picking scribe adds scribe questions later on.");

  // 3. Scribe questions and the governance-cost question
  await page.evaluate(ans => { state.answers = JSON.parse(JSON.stringify(ans)); }, SCRIBE);
  await page.evaluate(() => renderSection(2));
  await scrollTo("#qblock-q_alert_rate");
  await caption("Clinical & Ops: the duplicate subgroup question is gone, and 'how it was measured' is split from 'what it showed'. New: alert rate, override rate.");
  await scrollTo("#qblock-q_baseline");
  await caption("New from the current debate: baseline before go-live, how many paid seats are actually used, where the saved time went, and how much time goes to checking it, and by whom.", 4600);
  await scrollTo("#qblock-q_scribe_time");
  await caption("Scribe-only questions: was time saved measured here or is it the vendor's number, are notes checked for errors, how is recording consent handled.");
  await page.evaluate(() => renderSection(3));
  await scrollTo("#qblock-q_assurance_cost");
  await caption("Financial: new question, does the cost include the ongoing cost of checking the tool? That's the human-assurance overhead.");
  await scrollTo("#qblock-q_coding_source");
  await caption("Coding: is higher billing part of the value case? If yes: is it audited, do clinicians see the codes, and what does it cost patients and payers?", 4600);
  await scrollTo("#qblock-q_exit_cost");
  await caption("And: what leaving would cost, and whether it was compared with alternatives, including your EHR vendor's built-in option.");

  // 4. Full report: thinking block first, documented strategy
  await load(SCRIBE);
  await generate({ thinking: true, text: JSON.stringify(GOOD) });
  results.fullOk = await page.locator(".dimension-card").count();
  await caption("Report. The AI reply starts with a thinking block, which used to make every run fail with 'No content returned'. Now it reads fine.");
  await scrollTo(".how-rated");
  await caption("Ratings come from fixed rules on your answers. Each one shows why. AI-written parts are labeled.");
  await scrollTo(".flags-section");
  results.flags = await page.locator(".flags-section li").count();
  await caption("New: 'What your answers flag', set by rules. Codes billed without clinician review, unaudited coding, cost to patients, no baseline, lock-in, informal consent...", 5200);
  await scrollTo(".dimension-card:nth-child(1)");
  await caption("Clinical: measured locally, but with no baseline from before go-live, so moderate, not strong. And the result questioned the value.", 4400);
  await scrollTo(".dimension-card:nth-child(3)");
  await caption("Financial: partial analysis, coding gains not regularly audited, checking cost left out. Gross, not net. No invented percentage.", 4600);
  await scrollTo(".dimension-card:nth-child(6)");
  await caption("Non-monetary: burnout was surveyed before and after, so it can rise above 'impression only'.");
  results.selfCheck = await page.locator("text=Check the overall evidence rating").count();
  await scrollTo(".gap-map");
  await caption("Evidence map, also by rules: measured, assumed (estimates, vendor numbers, impressions), unknown.");
  await scrollTo(".recommendations-section");
  await caption("Strategy is documented with priorities picked, so recommendations appear, each tied to a priority.");
  await scrollTo(".commons-disclaimer:last-of-type");
  results.disclaimers = await page.locator(".commons-disclaimer").count();
  await caption("Shared Commons disclaimer at the top and bottom, so it prints with the PDF.");
  await page.evaluate(() => { const b = document.querySelector('.strategy-banner'); if (b) b.scrollIntoView(); });
  const sys = sent[sent.length - 1];
  results.noModelFromPage = !("model" in sys);

  // 5. Strategy in development: no recommendations even if the AI sends some
  await load({ ...SCRIBE, q_strategy: "Yes — in development" });
  await generate({ text: JSON.stringify(SNEAKY) });
  results.sneakyRecs = await page.locator(".recommendations-section").count();
  results.recsAskedInDev = sent[sent.length - 1].messages[0].content.includes("RECOMMENDATIONS: requested");
  await page.evaluate(() => document.querySelector('.strategy-banner').scrollIntoView());
  await caption("Strategy still in development: report only. The scripted AI slipped in a recommendation anyway, and the page drops it.");

  // 6. Thin intake plus an overconfident self-rating
  const THIN = { q_pathway: SCRIBE.q_pathway, q_system: "Thin Example", q_use_type: "Decision support at point of care — informs clinical judgment in real time",
    q_setting: "Emergency department", q_role: "Executive or administrative leadership", q_strategy: "Unknown",
    q_roi_defined: "Unknown", q_exit_threshold: "Unknown", q_clinical_expected: ["None identified yet"], q_clinical_status: "Unknown",
    q_operational_expected: ["None identified yet"], q_operational_status: "Unknown", q_cost: "Not known", q_assurance_cost: "Unknown",
    q_financial_categories: ["None identified yet"], q_financial_analysis: "Unknown", q_equity_relevant: "Uncertain",
    q_equity_analysis: "Unknown", q_harm_tracked: "Unknown", q_staff_trust: "Unknown — not assessed",
    q_evidence_overall: "Strong — robust data across multiple dimensions" };
  await load(THIN);
  await generate({ text: JSON.stringify(GOOD) });
  results.thin = await page.locator("text=Too little to assess").count();
  await page.evaluate(() => document.querySelector('.strategy-banner').scrollIntoView());
  await caption("Mostly 'Unknown': grey 'Too little to assess' banner, and grey 'Not assessed' badges instead of confident colors.");

  // 7. Cut off: the rules report still shows
  await load(SCRIBE);
  await generate({ text: JSON.stringify(GOOD).slice(0, 400), stop: "max_tokens" });
  results.cutoffStillReport = await page.locator(".dimension-card").count();
  await caption("AI reply cut off: the ratings, evidence map and data sources still show, with a note that the written parts didn't come through.");

  // 8. Hostile text stays text
  await load(SCRIBE);
  await generate({ text: JSON.stringify(HOSTILE) });
  results.pwned = await page.evaluate(() => !!window.__pwned);
  await scrollTo(".overall-narrative");
  await caption("Hostile AI text shows as plain text. Nothing runs.");

  // 9. Paused
  await load(SCRIBE);
  await generate({ status: 503, error: "Report generation is paused while this tool is reviewed." });
  results.pausedError = await page.locator(".error-phase").count();
  await caption("While ROI is still paused, the server's reason shows. The old 'check your API key' line is gone.");

  results.errors = errors;
  fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(results, null, 2));
  await browser.close();

  const list = frames.map(f => `file '${f.shot}'\nduration ${f.sec}`).join("\n") + `\nfile '${frames[frames.length - 1].shot}'\n`;
  fs.writeFileSync(path.join(out, "frames.txt"), list);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", path.join(out, "frames.txt"),
    "-vf", "fps=10,format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", path.join(out, "roi-review.mp4")]);
  console.log(JSON.stringify(results, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
