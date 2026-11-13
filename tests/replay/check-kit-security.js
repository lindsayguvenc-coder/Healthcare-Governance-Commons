// Security checks for the Local Validation Kit (Nov 13, 2026):
// 1. Online page shows the offline file's SHA-256, and it matches the published file.
// 2. A loaded file with formula-looking IDs downloads as spreadsheet-safe CSV.
// 3. The offline copy, opened from disk (file://), works with zero network requests,
//    blocks fetch, and shows the counts to enter by hand.
// Usage: node check-kit-security.js http://localhost:3000 ./out [chromePath]
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const base = process.argv[2], out = path.resolve(process.argv[3]), exe = process.argv[4];
const repo = path.resolve(__dirname, "../..");
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch(exe ? { executablePath: exe } : {});
  const ctx = await b.newContext({ acceptDownloads: true });
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(e.message));
  const r = {};
  // 0. Paused for review: without ?review=1 only the header and the pause notice show.
  await page.goto(`${base}/local-validation/`);
  r.pausedHidesTool = !(await page.isVisible("#pack")) && !(await page.isVisible("#security")) && await page.isVisible("#paused");
  await page.goto(`${base}/local-validation/?review=1`);
  r.reviewModeShowsTool = await page.isVisible("#pack");
  await page.click("#security summary");
  r.hashShown = await page.textContent("#offline-hash");
  const dl = page.waitForEvent("download"); await page.click("#offline-link");
  const offline = path.join(out, "local-validation-kit-offline.html"); await (await dl).saveAs(offline);
  r.hashMatches = crypto.createHash("sha256").update(fs.readFileSync(offline)).digest("hex") === r.hashShown;
  // Formula trap
  const trap = path.join(out, "trap.csv");
  const head = "encounter_id,model_score,blood_culture,qad_count,short_course_ok,vasopressor_start,mech_vent_start,lactate_max,creatinine_ratio,esrd,bilirubin_max,bilirubin_ratio,platelet_min,platelet_baseline";
  fs.writeFileSync(trap, head + "\n" + ['=HYPERLINK("http://evil.example","x")', "+1+1", "@SUM(A1)", "-2+3", "E1"].map((id) => `"${id.replace(/"/g, '""')}",0.7,0,0,0,0,0,1,1,0,0.5,1,200,200`).join("\n") + "\n");
  await page.setInputFiles("#file", trap); await page.waitForTimeout(200);
  await page.click("#start"); await page.click("#q-done").catch(() => {}); await page.waitForTimeout(200);
  const dl2 = page.waitForEvent("download"); await page.click("#dl-labels");
  const labels = path.join(out, "labels.csv"); await (await dl2).saveAs(labels);
  const lines = fs.readFileSync(labels, "utf8").trim().split("\n").slice(1);
  r.formulaCellsNeutralized = lines.every((l) => !/^"[=+\-@]/.test(l));
  r.sampleLine = lines[0];
  // Offline copy from disk
  const op = await ctx.newPage(); const oerrs = []; op.on("pageerror", (e) => oerrs.push(e.message));
  let reqs = 0; op.on("request", (q) => { if (!q.url().startsWith("file:") && !q.url().startsWith("data:") && !q.url().startsWith("blob:")) reqs++; });
  await op.goto("file://" + offline); r.offlinePausedByDefault = await op.evaluate(() => document.body.classList.contains("kit-paused")); await op.goto("file://" + offline + "?review=1"); await op.waitForTimeout(400);
  r.offlineFlag = await op.evaluate(() => !!window.LVK_OFFLINE);
  r.offlineFetchBlocked = await op.evaluate(() => fetch("https://example.com").then(() => false, () => true));
  await op.click("#sample"); await op.waitForTimeout(200);
  r.offlineSorted = await op.locator("#sort-stats .stat b").allTextContents();
  await op.click("#start");
  for (let i = 0; i < 400; i++) { const c = await op.textContent("#q-count"); await op.keyboard.press("2"); const m = c.match(/Case (\d+) of (\d+)/); if (m && +m[1] >= +m[2]) break; }
  await op.click("#q-done"); await op.waitForTimeout(200);
  await op.click("#to-vpg"); await op.waitForTimeout(100);
  r.offlineHandText = await op.textContent("#vpg-hand");
  r.offlineNetworkRequests = reqs;
  r.errors = errs.concat(oerrs);
  await b.close();
  console.log(JSON.stringify(r, null, 1));
  fs.writeFileSync(path.join(out, "results.json"), JSON.stringify(r, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
