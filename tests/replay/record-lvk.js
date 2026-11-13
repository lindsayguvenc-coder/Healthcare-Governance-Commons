// Records a captioned video of the Local Validation Kit (Nov 13, 2026): the made-up
// sample, the rules, a full workqueue (reviewer A, then reviewer B on a 20% sample),
// results, and the hand-off into a real Validation Protocol PDF. Checks that the page
// sends nothing over the network.
// Usage (server on port 3000, see server.js):
//   node record-lvk.js http://localhost:3000 ./video-lvk [chromePath]
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const base = process.argv[2];
const out = path.resolve(process.argv[3]);
const exe = process.argv[4];
const repo = path.resolve(__dirname, "../..");

// Rules, in Node, to play a believable reviewer: agrees with the rules on audit cases
// about 95% of the time, and decides hard cases from the data.
// Load the page's own engine and pack into a fake window, the way the browser does.
const vm = require("vm");
const kitWin = {};
const kitCtx = vm.createContext({ window: kitWin, globalThis: kitWin });
for (const f of ["engine.js", "sepsis-ase.js"]) vm.runInContext(fs.readFileSync(path.join(repo, "public/local-validation", f), "utf8"), kitCtx);
const LVK = kitWin.LVK, PACK = kitWin.RULE_PACKS.sepsis_ase;
const csv = fs.readFileSync(path.join(repo, "public/local-validation/sample-sepsis.csv"), "utf8").trim().split("\n");
const head = csv[0].split(",");
const ROWS = Object.fromEntries(csv.slice(1).map((l) => { const v = l.split(","); const r = Object.fromEntries(head.map((k, i) => [k, v[i]])); return [r.encounter_id, r]; }));
let seed = 7;
const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
function reviewerAnswer(id) {
  const r = ROWS[id];
  const o = LVK.labelRow(PACK, r);
  if (o.label !== "unsure") return rand() < 0.95 ? o.label : (o.label === "yes" ? "no" : "yes");
  const lac = Number(r.lactate_max);
  if (r.qad_count === "") return rand() < 0.3 ? "unsure" : (lac >= 2 ? "yes" : "no");
  return lac >= 2 || Number(r.creatinine_ratio) >= 2 ? "yes" : "no";
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 }, acceptDownloads: true });
  await ctx.route("**/jspdf.umd.min.js", (r) => r.fulfill({ path: require.resolve("jspdf/dist/jspdf.umd.min.js"), contentType: "text/javascript" }));
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const frames = [];
  const caption = async (text, ms = 3200) => {
    await page.evaluate((t) => {
      let el = document.getElementById("__cap");
      if (!el) { el = document.createElement("div"); el.id = "__cap";
        el.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:99999;padding:14px 22px;background:rgba(10,12,20,.94);color:#f5f0ff;font:600 17px/1.4 system-ui,sans-serif;border-top:2px solid #a78bfa";
        document.body.appendChild(el); }
      el.textContent = t;
    }, text);
    const shot = path.join(out, `frame-${String(frames.length).padStart(3, "0")}.png`);
    await page.screenshot({ path: shot });
    frames.push({ shot, sec: ms / 1000 });
  };
  const to = (sel) => page.locator(sel).first().evaluate((e) => e.scrollIntoView({ block: "start" }));
  const results = {};

  await page.goto(`${base}/local-validation/`);
  await page.waitForTimeout(500);
  await caption("Local Validation Kit. Test a model on your own past patients: rules first, a person only for the hard cases.", 4200);
  await to(".safe");
  await caption("Your file never leaves the browser. The page's security policy blocks every network request, so this is enforced, not just promised.", 4600);
  results.fetchBlocked = await page.evaluate(() => fetch("/api/status").then(() => false, () => true));
  await to("#pack");
  await caption("Step 1: the rule pack. Packs are plain data, and the page writes the rules out in plain English: that list is what a clinician signs off on.", 5200);
  results.rulesShown = await page.locator("#rules-gate li, #rules-crit li").count();
  results.draftShown = (await page.textContent("#pack-status")).startsWith("Draft");
  // Load a custom pack from a file: the template
  const dlT = page.waitForEvent("download");
  await page.click("#dl-pack-template");
  const tplFile = path.join(out, "template.json");
  await (await dlT).saveAs(tplFile);
  await page.setInputFiles("#pack-file", tplFile);
  await page.waitForTimeout(200);
  results.customPackLoaded = (await page.textContent("#pack-msg")).startsWith("Loaded your pack");
  results.customRules = await page.locator("#rules-gate li, #rules-crit li").allTextContents();
  await caption("Any outcome fits the same shape: 'these must hold, then any one of these'. Here a hospital loads its own pack from a file. It stays in the browser.", 5200);
  const badPack = path.join(out, "badpack.json");
  fs.writeFileSync(badPack, JSON.stringify({ id: "x", name: "x", labels: { yes: "a", no: "b" }, columns: [{ name: "encounter_id" }], gate: [{ col: "nope", is: true }], criteria: [] }));
  await page.setInputFiles("#pack-file", badPack);
  await page.waitForTimeout(150);
  results.badPackMsg = await page.textContent("#pack-msg");
  await page.selectOption("#pack-pick", "sepsis_ase");
  await page.waitForTimeout(150);
  await page.click("details summary");
  await caption("Step 2: one row per encounter. The analyst's query does the date math; the SQL and FHIR files are starting points.", 4600);

  // Count any request the page makes from here on (it should make none)
  let requests = 0;
  page.on("request", (r) => { if (!r.url().startsWith("data:") && !r.url().startsWith("blob:")) requests++; });

  await page.click("#sample");
  await page.waitForTimeout(300);
  await to("#sorted");
  results.sortStats = await page.locator("#sort-stats .stat b").allTextContents();
  await caption(`Made-up data, 800 encounters. The rules decided ${results.sortStats[0]} yes and ${results.sortStats[1]} no; ${results.sortStats[2]} are too close to call, plus ${results.sortStats[3]} for a blind audit.`, 5600);
  await caption((await page.textContent("#work-line")), 4600);
  results.auditLine = await page.textContent("#audit-line");
  await caption("The audit is sized by the precision you want, not a flat percent: enough cases to show the rules are at least 90% accurate.", 5000);

  await page.click("#start");
  await page.waitForTimeout(200);
  await to("#queue");
  await caption("The workqueue. One encounter per screen: open it in the EHR, press 1, 2 or 3. The rule's answer is hidden.", 4600);
  let n = 0;
  for (;;) {
    const title = await page.textContent("#q-title");
    const id = title.replace("Encounter ", "").trim();
    const count = await page.textContent("#q-count");
    if (n === 1) await caption("A hard case shows what to check. Audit cases look the same as any other, so the reviewer can't tell which they are.", 4600);
    const a = reviewerAnswer(id);
    await page.keyboard.press(a === "yes" ? "1" : a === "no" ? "2" : "3");
    n++;
    const m = count.match(/Case (\d+) of (\d+)/);
    if (m && Number(m[1]) >= Number(m[2])) break;
    if (n > 400) break;
  }
  results.answeredA = n;
  await caption(`Reviewer A finished ${n} cases.`, 2200);
  await page.click("#q-second");
  await page.waitForTimeout(200);
  let nb = 0;
  for (;;) {
    const id = (await page.textContent("#q-title")).replace("Encounter ", "").trim();
    const count = await page.textContent("#q-count");
    const a = rand() < 0.9 ? reviewerAnswer(id) : "no";
    await page.keyboard.press(a === "yes" ? "1" : a === "no" ? "2" : "3");
    nb++;
    const m = count.match(/Case (\d+) of (\d+)/);
    if (m && Number(m[1]) >= Number(m[2])) break;
    if (nb > 200) break;
  }
  results.answeredB = nb;
  await caption(`Reviewer B did a 20% sample (${nb} cases) for an agreement number.`, 3000);

  await page.click("#q-done");
  await page.waitForTimeout(300);
  await to("#results");
  results.counts = await page.locator("#counts .stat b").allTextContents();
  results.perf = await page.textContent("#perf");
  results.ruleAcc = await page.textContent("#rule-acc");
  results.moreAuditOffered = !(await page.locator("#more-audit").isHidden());
  results.kappa = await page.textContent("#kappa");
  await caption("Results: the four counts, sensitivity and specificity with intervals, how often the rules matched the reviewer, and reviewer agreement.", 6000);
  await to("#group-table");
  results.groups = await page.locator("#group-table tbody tr").count();
  await caption("By patient group. Small groups get wide intervals, and the page says so.", 4200);

  const dl = page.waitForEvent("download");
  await page.click("#dl-labels");
  const labelsFile = path.join(out, "labels.csv");
  await (await dl).saveAs(labelsFile);
  results.labelsRows = fs.readFileSync(labelsFile, "utf8").trim().split("\n").length - 1;
  results.requestsWhileWorking = requests;

  // Hand off to the VPG
  await page.click("#to-vpg");
  await page.waitForLoadState("load");
  await page.waitForTimeout(800);
  results.vpgPrefill = await page.evaluate(() => [state.answers.q_tp, state.answers.q_fn, state.answers.q_tn, state.answers.q_fp]);
  results.storageCleared = await page.evaluate(() => localStorage.getItem("commons.lvk.counts") === null);
  await caption("Into the Validation Protocol: the counts arrive filled in, numbers only, and the hand-off is cleared after reading.", 4600);
  await page.evaluate(() => {
    Object.assign(state.answers, { q0: "primary", q0b: "full", q1_orgname: "Example County Medical Center", q1_system: "Example Sepsis Alert",
      q2_usetype: "Risk stratification — identifies patients for intervention or escalation", q3_prevalence: "5 — 15%" });
    goToReady();
  });
  await page.waitForTimeout(500);
  const dl2 = page.waitForEvent("download");
  await page.locator("#generate-btn").click();
  const pdf = path.join(out, "vpg-from-kit.pdf");
  await (await dl2).saveAs(pdf);
  const text = execFileSync("pdftotext", ["-layout", pdf, "-"]).toString().replace(/\s+/g, " ");
  results.pdfHasKitSource = text.includes("Local Validation Kit, rule pack sepsis_ase");
  results.pdfHasCI = /95% CI/.test(text);
  execFileSync("pdftoppm", ["-png", "-r", "70", "-f", "2", "-l", "2", pdf, path.join(out, "pg")]);
  const pg = fs.readdirSync(out).find((f) => /^pg-\d+\.png$/.test(f));
  await page.setContent(`<body style="margin:0;background:#2a2a33;display:flex;justify-content:center;padding-top:12px"><img src="data:image/png;base64,${fs.readFileSync(path.join(out, pg)).toString("base64")}" style="height:740px"></body>`);
  await caption("The protocol's At a Glance page: local sensitivity and specificity with intervals, from the kit's counts. The source is recorded in Section 2.", 5600);

  // A file missing required columns gets a plain message
  await page.goto(`${base}/local-validation/`);
  const bad = path.join(out, "bad.csv");
  fs.writeFileSync(bad, "encounter_id,model_score\nX1,0.4\n");
  await page.setInputFiles("#file", bad);
  await page.waitForTimeout(200);
  results.badFileMsg = await page.textContent("#load-msg");
  await caption(errors.length ? `Page errors: ${errors.join(" | ")}` : "Done. No page errors, and no network requests while working.", 3000);

  await browser.close();
  fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(results, null, 2));
  const list = path.join(out, "frames.txt");
  fs.writeFileSync(list, frames.map((f) => `file '${f.shot}'\nduration ${f.sec}`).join("\n") + `\nfile '${frames.at(-1).shot}'\n`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-vf", "fps=10,format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", path.join(out, "local-validation-kit.mp4")]);
  console.log(JSON.stringify({ results, errors }, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
