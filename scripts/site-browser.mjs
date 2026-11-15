// Weekly browser checks: batch 3b of the Site QC crosswalk. Opens the live site
// in a real (headless) Chrome. Runs from .github/workflows/site-weekly.yml after
// the plain-code checks, and locally with:
//   SITE=http://localhost:4300 node scripts/site-browser.mjs
// Needs playwright and axe-core (installed in tests/replay by the workflow).
//
//   F1  every page loads with no script errors
//   P4  no page asks anything from another site while it loads (live proof of
//       the privacy inventory: fonts and scripts are self-hosted)
//   N3  accessibility (axe-core, serious and critical issues) and no sideways
//       scrolling on a phone; judged against a saved baseline, so only new
//       problems fail and known ones show as warnings to work down
//   F5  the Validation Protocol Generator builds its PDF for the fixed test case
//   P3  the Local Validation Kit stays paused by default and sends nothing
//       anywhere, online and as the offline file opened from disk
//
// Seeded controls ride along with each check. Writes qc-out/site-browser.json.
// Exits 1 on a failure.

import { readFileSync, readdirSync, statSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const root = new URL("..", import.meta.url).pathname;
const require = createRequire(join(root, "tests/replay/package.json"));
const { chromium } = require("playwright");
const AXE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const read = p => readFileSync(join(root, p), "utf8");
const SITE = (process.env.SITE || "https://healthcare-governance-commons.vercel.app").replace(/\/$/, "");
const ORIGIN = new URL(SITE).origin;
const results = [];
const rec = (id, check, kind, level, detail = "") => results.push({ id, check, kind, level, ok: level !== "fail", detail });
const pass = (id, check, kind, cond, detail = "") => rec(id, check, kind, cond ? "ok" : "fail", cond ? "" : detail);

// Pages: every tool page in the repo, the map, and every node page.
const pages = ["/"];
for (const d of readdirSync(join(root, "public"))) {
  if (["fonts", "vendor"].includes(d)) continue;
  if (statSync(join(root, "public", d)).isDirectory() && existsSync(join(root, "public", d, "index.html"))) pages.push(`/${d}/`);
}
for (const n of JSON.parse(read("src/data/nodes.json"))) pages.push(`/nodes/${n.id}`);

const baselineFile = "tests/site-qc/a11y-baseline.json";
const baseline = existsSync(join(root, baselineFile)) ? JSON.parse(read(baselineFile)).issues : null;
const found = {}; // "page|rule" -> count, for the baseline

const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});

async function openPage(ctx, url, { phone = false } = {}) {
  const page = await ctx.newPage();
  if (phone) await page.setViewportSize({ width: 390, height: 844 });
  const errors = [], outside = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/favicon|Failed to load resource: the server responded with a status of 404/.test(m.text())) errors.push(m.text()); });
  page.on("request", r => { const u = r.url(); if (/^https?:/.test(u) && new URL(u).origin !== ORIGIN) outside.push(u); });
  await page.goto(url, { waitUntil: "load", timeout: 45000 });
  await page.waitForTimeout(1200);
  return { page, errors, outside };
}
async function axeIssues(page) {
  await page.addScriptTag({ content: AXE });
  const r = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ["violations"] })).violations
    .filter(v => v.impact === "serious" || v.impact === "critical").map(v => ({ id: v.id, n: v.nodes.length, help: v.help })));
  return r;
}

// ── Controls first: if these miss, the checks below can't be trusted ─────────
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.setContent(`<html lang="en"><head><title>c</title></head><body><main><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw="><button></button><script>throw new Error("qc-control")</script></main></body></html>`);
  await page.waitForTimeout(200);
  pass("F1", "Control: a planted script error is caught", "control", errs.some(e => /qc-control/.test(e)));
  const ax = await axeIssues(page);
  pass("N3", "Control: a planted image without alt text and an unlabeled button are caught", "control", ax.some(v => v.id === "image-alt") && ax.some(v => v.id === "button-name"), JSON.stringify(ax.map(v => v.id)));
  const wide = await ctx.newPage(); await wide.setViewportSize({ width: 390, height: 844 });
  await wide.setContent(`<body style="margin:0"><div style="width:900px">wide</div></body>`);
  pass("N3", "Control: a planted too-wide page is caught", "control", await wide.evaluate(() => document.documentElement.scrollWidth > 395));
  await ctx.close();
}

// ── F1, P4, N3: every page ───────────────────────────────────────────────────
{
  const ctx = await browser.newContext();
  for (const p of pages) {
    let o;
    try { o = await openPage(ctx, SITE + p); } catch (e) { rec("F1", `Page ${p} loads`, "check", "fail", String(e.message).slice(0, 120)); continue; }
    pass("F1", `No script errors on ${p}`, "check", o.errors.length === 0, o.errors.slice(0, 3).join(" | ").slice(0, 300));
    pass("P4", `Nothing loads from another site on ${p}`, "check", o.outside.length === 0, [...new Set(o.outside.map(u => new URL(u).host))].join(", "));
    for (const v of await axeIssues(o.page)) found[`${p}|${v.id}`] = { n: v.n, help: v.help };
    await o.page.close();
    const ph = await openPage(ctx, SITE + p, { phone: true });
    const sw = await ph.page.evaluate(() => document.documentElement.scrollWidth);
    if (sw > 395) found[`${p}|phone-sideways-scroll`] = { n: 1, help: `page is ${sw}px wide on a 390px phone` };
    await ph.page.close();
  }
  await ctx.close();
  if (!baseline) {
    rec("N3", `No accessibility baseline yet: ${Object.keys(found).length} known issues recorded`, "check", "warn", `save qc-out/a11y-found.json as ${baselineFile}`);
  } else {
    for (const [k, v] of Object.entries(found)) {
      const [pg, rule] = k.split("|");
      const was = baseline[k]?.n ?? 0;
      if (v.n > was) rec("N3", `New accessibility problem on ${pg}: ${rule} (${v.help})`, "check", "fail", `${v.n} element(s), baseline ${was}`);
      else rec("N3", `Known accessibility issue on ${pg}: ${rule} (${v.help})`, "check", "warn", `${v.n} element(s); fix and then shrink the baseline`);
    }
    const fixed = Object.keys(baseline).filter(k => !found[k]);
    if (fixed.length) rec("N3", `${fixed.length} baseline issue(s) are fixed: shrink ${baselineFile}`, "check", "warn", fixed.slice(0, 5).join(", "));
  }
  rec("N3", `${pages.length} pages checked: ${Object.keys(found).length} accessibility or phone-width issues`, "check", "ok");
}

// ── F5: the Validation Protocol Generator's PDF ──────────────────────────────
const looksLikePdf = buf => buf.length > 20000 && buf.subarray(0, 5).toString() === "%PDF-" && (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length >= 3;
pass("F5", "Control: something that isn't a PDF fails the PDF test", "control", !looksLikePdf(Buffer.from("<html>not a pdf</html>".repeat(2000))));
{
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", e => errs.push(e.message));
  try {
    await page.goto(`${SITE}/validation-protocol/`, { waitUntil: "load" });
    await page.waitForTimeout(800);
    const paused = await page.evaluate(() => /paused/i.test(document.body.innerText.slice(0, 4000)) && !document.querySelector("#generate-btn"));
    const answers = JSON.parse(read("tests/site-qc/vpg-case.json")).answers;
    await page.evaluate(a => { Object.assign(state.answers, a); goToReady(); }, answers);
    await page.waitForTimeout(500);
    const dl = page.waitForEvent("download", { timeout: 60000 });
    await page.locator("#generate-btn").click();
    const file = await (await dl).path();
    const buf = readFileSync(file);
    pass("F5", "Protocol PDF builds for the fixed test case", "check", looksLikePdf(buf), `${buf.length} bytes`);
    pass("F5", "No script errors while building the PDF", "check", errs.length === 0, errs.slice(0, 3).join(" | "));
    if (paused) rec("F5", "Generator looked paused, yet built a PDF", "check", "warn");
  } catch (e) { rec("F5", "Protocol PDF builds for the fixed test case", "check", "fail", String(e.message).slice(0, 200)); }
  await ctx.close();
}

// ── P3: the Local Validation Kit sends nothing ───────────────────────────────
{
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", e => errs.push(e.message));
  try {
    await page.goto(`${SITE}/local-validation/`, { waitUntil: "load" });
    pass("P3", "Kit is paused by default (tool hidden, pause notice shown)", "check",
      !(await page.isVisible("#pack")) && await page.isVisible("#paused"));
    await page.goto(`${SITE}/local-validation/?review=1`, { waitUntil: "load" });
    await page.waitForTimeout(500);
    let sent = []; page.on("request", r => { const u = r.url(); if (/^https?:/.test(u)) sent.push(u); });
    // control: the page's own security policy must block a request from inside it
    const blocked = await page.evaluate(() => fetch("https://example.com/qc-control").then(() => false, () => true));
    pass("P3", "Control: a request from inside the kit is blocked by its security policy", "control", blocked);
    sent = [];
    await page.click("#sample"); await page.waitForTimeout(300);
    await page.click("#start");
    for (let i = 0; i < 400; i++) { const c = await page.textContent("#q-count"); await page.keyboard.press("2"); const m = (c || "").match(/Case (\d+) of (\d+)/); if (m && +m[1] >= +m[2]) break; }
    await page.click("#q-done"); await page.waitForTimeout(300);
    pass("P3", "Kit sends nothing while running a full sample review", "check", sent.length === 0, [...new Set(sent)].slice(0, 5).join(", "));
    // offline copy, opened from disk
    await page.click("#security summary");
    const dl = page.waitForEvent("download"); await page.click("#offline-link");
    const file = join(root, "qc-out", "kit-offline-copy.html"); // must end in .html to open as a page
    mkdirSync(join(root, "qc-out"), { recursive: true });
    await (await dl).saveAs(file);
    const op = await ctx.newPage(); let oreq = 0;
    op.on("request", r => { if (/^https?:/.test(r.url())) oreq++; });
    await op.goto("file://" + file);
    pass("P3", "Offline copy is paused by default", "check", await op.evaluate(() => document.body.classList.contains("kit-paused")));
    await op.goto("file://" + file + "?review=1"); await op.waitForTimeout(300);
    await op.click("#sample"); await op.waitForTimeout(200);
    pass("P3", "Offline copy sends nothing", "check", oreq === 0, `${oreq} request(s)`);
    pass("P3", "No script errors in the kit", "check", errs.length === 0, errs.slice(0, 3).join(" | "));
  } catch (e) { rec("P3", "Local Validation Kit check ran", "check", "fail", String(e.message).slice(0, 200)); }
  await ctx.close();
}

await browser.close();

// ── Report ───────────────────────────────────────────────────────────────────
mkdirSync(join(root, "qc-out"), { recursive: true });
writeFileSync(join(root, "qc-out/a11y-found.json"), JSON.stringify({ _about: "Accessibility and phone-width issues found on the live site. Saved as the baseline in " + baselineFile + "; only issues beyond it fail.", savedAt: new Date().toISOString().slice(0, 10), issues: found }, null, 2));
const failed = results.filter(r => r.level === "fail"), warned = results.filter(r => r.level === "warn");
const controls = results.filter(r => r.kind === "control");
writeFileSync(join(root, "qc-out/site-browser.json"), JSON.stringify({
  agent: "Site checks (weekly, browser)", site: SITE, time: new Date().toISOString(),
  failedSite: failed.filter(r => r.kind === "check").length, failedControls: failed.filter(r => r.kind === "control").length,
  warnings: warned.length, controlsCaught: Math.round(1000 * controls.filter(r => r.ok).length / (controls.length || 1)) / 10, results,
}, null, 2));
for (const id of [...new Set(results.map(r => r.id))]) {
  const rs = results.filter(r => r.id === id);
  console.log(`${id}: ${rs.filter(r => r.level === "fail").length} failed, ${rs.filter(r => r.level === "warn").length} warnings, ${rs.length} total`);
  for (const r of rs) if (r.level === "fail" || r.kind === "control") console.log(`  ${r.level === "fail" ? "✗" : "✓"} ${r.kind === "control" ? "[control] " : ""}${r.check}${r.detail && r.level === "fail" ? " — " + r.detail : ""}`);
}
const w = warned.length; if (w) console.log(`(${w} warnings in qc-out/site-browser.json)`);
process.exit(failed.length ? 1 : 0);
