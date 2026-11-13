// Records a captioned video of the VPG second content pass (Nov 13, 2026): the new
// questions, then two real PDFs from the real /api/generate-protocol and /api/vpg-engines
// code: one with the new questions answered, one with them left blank.
// Usage (server must be on port 3000, see server.js):
//   node server.js ../.. 3000 &
//   node record-vpg-second.js http://localhost:3000 ./video-vpg-second [chromePath]
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const base = process.argv[2];
const out = path.resolve(process.argv[3]);
const exe = process.argv[4];

// Same made-up ED sepsis alert as the Nov 12 replays.
const BASE = {
  q0: "primary", q0b: "full",
  q1_orgname: "Example County Medical Center", q1_dept: "Emergency Department",
  q1_system: "Example Sepsis Alert", q1_vendor: "Example Vendor Inc.", q1_version: "4.2",
  q2_usetype: "Triage / prioritization — direct impact on care sequencing",
  q30_age: "Predominantly adult (18–65)",
  q31_sex_record: "Binary with unknown / not recorded option",
  q32_race_record: "Combined race/ethnicity field",
  q35_payer: "Safety net — predominantly Medicaid / uninsured",
  q38_setting: "Emergency department",
  q3_prevalence: "5 — 15%",
  q7_cases: "Yes — accessible and ready",
  q_counts: "The four counts (true and false positives and negatives)",
  q_tp: 168, q_fn: 32, q_tn: 1512, q_fp: 288,
  q_false_alarms: 10, q_auc: 0.81,
  q_calibration: "Yes — it gives a probability, calibration not measured",
  q_subgroup: "Can be produced, not yet run",
  q_override: "Yes — source not yet defined",
  q19_cadence: "Monthly",
  q19_owner: "Named individual by role",
  q15a_authority: "Named individual by role", q15a_authority_role: "CMIO",
  q15_gap_time: "Within 4 hours",
  q22_warn_threshold: "5%", q23_action_threshold: "10%",
  q20_govbody: "Formal cross-functional governance committee",
  q41_policy: "Yes — approved", q42_training: "Scheduled before go-live",
  q43_disclosure: "Case by case", q44_consent: "Not yet decided",
  q45_safety_reporting: "Our safety event system, no AI category", q46_security: "In progress",
};
const ANSWERED = {
  ...BASE,
  q_autonomy: "Acts unless someone stops it — e.g. routes, orders or sends on its own, reviewed after",
  q_fda: "Cleared, with a predetermined change control plan (PCCP) for updates",
  q_vendor_demo: ["Race / ethnicity", "Sex / gender", "Age"],
  q_inputs_protected: "Yes — and we know which",
  q_patient_msgs: "Yes — some go out without clinician review",
  q_limits: "Not validated under 18. Vendor reports lower sensitivity in immunocompromised patients.",
  q_outcomes: "Yes — before/after measure planned, with a data source",
  q_contract_data: "Yes — written into the contract",
  q_contract_updates: "Yes — notice only, no time to test",
  q_contract_datause: "Only one of the two",
  q_contract_exit: "Only at renewal",
  q_decommission: "Criteria only",
};

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
  await ctx.route("**/jspdf.umd.min.js", r => r.fulfill({ path: require.resolve("jspdf/dist/jspdf.umd.min.js"), contentType: "text/javascript" }));
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  const frames = [];
  const caption = async (text, ms = 3000) => {
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
    const shot = path.join(out, `frame-${String(frames.length).padStart(3, "0")}.png`);
    await page.screenshot({ path: shot });
    frames.push({ shot, sec: ms / 1000 });
  };
  const scrollToQ = async (id) => {
    await page.evaluate(id => {
      const el = document.getElementById(id) || document.querySelector(`[data-group="${id}"]`) || document.querySelector(`[onclick*="'${id}'"]`);
      const block = el && (el.closest(".question-block") || el);
      if (block) block.scrollIntoView({ block: "start" });
    }, id);
    await page.waitForTimeout(250);
  };

  // 1. The new questions on screen
  await page.goto(`${base}/validation-protocol/`);
  await page.waitForTimeout(1000);
  await page.evaluate(a => { Object.assign(state.answers, a); state.phase = "elicit"; state.currentSection = 0; renderSection(0); }, ANSWERED);
  await page.waitForTimeout(500);
  await scrollToQ("q_autonomy");
  await caption("VPG second pass (Nov 13). New in Section 1: autonomy level and FDA status. Both feed rules the report already had but never used.", 5200);
  await scrollToQ("q_vendor_demo");
  await caption("Also new: what the vendor disclosed about its training patients, and whether it uses race, sex, age or disability as an input (Section 1557).", 5200);
  await scrollToQ("q_patient_msgs");
  await caption("And: does it write messages to patients (California AB 3030), plus known limits and contraindications.", 4600);
  const monIdx = await page.evaluate(() => { for (let i = 0; i < 8; i++) { const s = getSection(i); if (s && s.title && s.title.startsWith("Monitoring")) return i; } return 4; });
  await page.evaluate(i => { state.currentSection = i; renderSection(i); }, monIdx);
  await page.waitForTimeout(400);
  await scrollToQ("q_outcomes");
  await caption("Monitoring section: outcomes (did the thing it targets change?), four contract terms, and a retirement plan.", 4800);

  // 2. PDFs: answered and blank
  const pdfFor = async (answers, name) => {
    await page.goto(`${base}/validation-protocol/`);
    await page.waitForTimeout(800);
    await page.evaluate(a => { Object.assign(state.answers, a); goToReady(); }, answers);
    await page.waitForTimeout(500);
    const dl = page.waitForEvent("download");
    await page.locator("#generate-btn").click();
    const file = path.join(out, name);
    await (await dl).saveAs(file);
    return file;
  };
  const fileA = await pdfFor(ANSWERED, "vpg-answered.pdf");
  const fileB = await pdfFor(BASE, "vpg-blank.pdf");
  const textOf = f => execFileSync("pdftotext", ["-layout", f, "-"]).toString().replace(/\s+/g, " ");
  const tA = textOf(fileA), tB = textOf(fileB);
  const results = {
    autonomyPrinted: tA.includes("Acts unless someone stops it"),
    highAutonomyTightened: tA !== tB && /independent/i.test(tA),
    fdaPrinted: tA.includes("predetermined change control plan"),
    pccpFlag: tA.includes("lets the vendor update the model within that plan"),
    vendorAxesCompatible: !/VENDOR_DEMOGRAPHICS_NOT_RECORDED/.test(tA),
    blankVendorFlag: /VENDOR_DEMOGRAPHICS_NOT_RECORDED/.test(tB),
    flag1557: tA.includes("45 CFR 92.210), covered entities must"),
    flagAB3030: tA.includes("AB 3030") && tA.includes("disclaimer"),
    limitsPrinted: tA.includes("Not validated under 18"),
    contractSection: tA.includes("CONTRACT TERMS") || tA.includes("Contract Terms"),
    readinessPrinted: /Not ready to go live|Baseline go-live conditions met/.test(tA),
    regRefs: tA.includes("Regulatory References for This Deployment") || tA.includes("REGULATORY REFERENCES"),
    regRef1557: /1557, 45 CFR 92\.210/.test(tA),
    regRefPccp: /change control plan guidance/i.test(tA),
    blankAutonomyGap: tB.includes("Autonomy level not set"),
    blankFdaGap: tB.includes("FDA status unknown"),
    noOldNotAsked: !/(AUTONOMY LEVEL|FDA STATUS)\s+Not asked/.test(tB),
  };

  execFileSync("pdftoppm", ["-png", "-r", "70", fileA, path.join(out, "a")]);
  const pngs = fs.readdirSync(out).filter(f => /^a-\d+\.png$/.test(f)).sort();
  const img = n => "data:image/png;base64," + fs.readFileSync(path.join(out, pngs[n - 1])).toString("base64");
  const find = text => {
    for (let i = 1; i <= pngs.length; i++) {
      const t = execFileSync("pdftotext", ["-f", String(i), "-l", String(i), fileA, "-"]).toString().replace(/\s+/g, " ");
      if (t.includes(text)) return i;
    }
    return 1;
  };
  const show = async (n, text, ms = 4800) => {
    await page.setContent(`<body style="margin:0;background:#2a2a33;display:flex;justify-content:center;padding-top:12px">
      <img src="${img(n)}" style="height:740px;box-shadow:0 4px 30px #000"></body>`);
    await caption(`Page ${n} of ${pngs.length} · ${text}`, ms);
  };
  await show(find("Acts unless someone stops it"), "Section 1: autonomy and the two new rows (protected inputs, messages to patients) print from the answers instead of 'fill in by hand'.");
  await show(find("predetermined change control plan"), "Section 2: FDA status, the vendor-disclosed patient groups, and known limits are now real answers.");
  await show(find("compatible ·"), "Section 3: the bias table fills in from what the vendor disclosed (race, sex, age), instead of ten unknowns.", 5200);
  await show(find("Not ready to go live") || find("Baseline go-live"), "Section 6: the readiness verdict now prints, and it comes from the conditions listed under it, so they can't disagree. New: contract terms, outcomes and retirement.", 6200);
  await show(find("Regulatory References"), "Section 7: references for this deployment come from the site's own regulatory map (1557, the PCCP guidance, AB 3030, TJC + CHAI), dated.", 6200);
  await show(find("AB 3030"), "Gap flags from the new answers: Section 1557, AB 3030, the PCCP, contract terms, retirement.", 5200);
  await caption(errors.length ? `Page errors: ${errors.join(" | ")}` : "Done. No page errors.", 2500);

  await ctx.close();
  await browser.close();
  fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(results, null, 2));
  const list = path.join(out, "frames.txt");
  fs.writeFileSync(list, frames.map(f => `file '${f.shot}'\nduration ${f.sec}`).join("\n") + `\nfile '${frames.at(-1).shot}'\n`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list,
    "-vf", "fps=10,format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", path.join(out, "vpg-second-pass.mp4")]);
  console.log(JSON.stringify({ results, pages: pngs.length, errors }, null, 2));
})();
