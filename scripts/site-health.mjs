// Daily site health: the plain-code checks from the Site QC crosswalk, batch 1.
// Runs against the live site (SITE, default the Vercel URL) from
// .github/workflows/site-health.yml, and locally with:
//   SITE=http://localhost:4300 node scripts/site-health.mjs
//
//   F1  every page loads, with the title the repo says it should have
//   F6  paused tools stay paused; an unknown tool fails closed
//   P1  the patient-info screen refuses planted identifiers (server, and the
//       browser copy agrees with the server copy)
//   X2  private endpoints refuse calls with no token or a wrong one
//
// Every check carries seeded controls: cases with a known answer. A control
// that isn't caught means the checker itself is broken, which is a reject for
// the checker, not just for the site. Nothing here calls the AI: every planted
// request is refused before it gets that far.
//
// Writes qc-out/site-health.json (full log) and qc-out/site-health-runs.csv
// (rows the Agent Fleet QC page can import). Exits 1 on any failure.

import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";

const root = new URL("..", import.meta.url).pathname;
const require = createRequire(import.meta.url);
const SITE = (process.env.SITE || "https://healthcare-governance-commons.vercel.app").replace(/\/$/, "");
const AGENT = "Site health (daily)";
const results = []; // {id, check, kind:'check'|'control', ok, detail}
const rec = (id, check, kind, ok, detail = "") => results.push({ id, check, kind, ok: Boolean(ok), detail });

async function get(path, opts = {}) {
  try {
    const r = await fetch(SITE + path, { redirect: "follow", ...opts });
    const text = await r.text();
    return { status: r.status, text };
  } catch (e) {
    return { status: 0, text: String(e.message || e) };
  }
}
// Planted requests ask for at most 1 output token, so if a screen ever fails and
// one gets through to the AI, it costs next to nothing.
const post = (path, body, headers = {}) => get(path, {
  method: "POST",
  headers: { "content-type": "application/json", origin: SITE, ...headers },
  body: JSON.stringify(body),
});
const titleOf = html => (html.match(/<title>([\s\S]*?)<\/title>/i) || [, ""])[1].replace(/\s+/g, " ").trim();

// ── F1: pages load with the expected title ───────────────────────────────────
const pages = [{ path: "/", title: titleOf(readFileSync(join(root, "index.html"), "utf8")) }];
for (const dir of readdirSync(join(root, "public"))) {
  const f = join(root, "public", dir, "index.html");
  if (statSync(join(root, "public", dir)).isDirectory() && existsSync(f)) {
    pages.push({ path: `/${dir}/`, title: titleOf(readFileSync(f, "utf8")) });
  }
}
const nodes = JSON.parse(readFileSync(join(root, "src/data/nodes.json"), "utf8"));
for (const n of nodes) pages.push({ path: `/nodes/${n.id}`, title: pages[0].title });

async function pageOk(p) {
  const r = await get(p.path);
  if (r.status !== 200) return [false, `HTTP ${r.status}`];
  const t = titleOf(r.text);
  if (p.title && t !== p.title) return [false, `title "${t}" (expected "${p.title}")`];
  return [true, ""];
}
for (const p of pages) {
  const [ok, why] = await pageOk(p);
  rec("F1", `Page ${p.path}`, "check", ok, why);
}
{ // control: a page that doesn't exist must fail the same test
  const [ok] = await pageOk({ path: "/qc-control-missing-page/", title: "QC control page that does not exist" });
  rec("F1", "Control: a missing page is reported", "control", !ok, ok ? "the page test passed a page that doesn't exist" : "");
}

// ── F6: pause switches ───────────────────────────────────────────────────────
{
  // In-process: the pause logic itself, under each setting of REPORTS_PAUSED.
  const file = require.resolve(join(root, "api/_pause.js"));
  const load = env => {
    const keep = process.env.REPORTS_PAUSED;
    if (env === undefined) delete process.env.REPORTS_PAUSED; else process.env.REPORTS_PAUSED = env;
    delete require.cache[file];
    const m = require(file);
    const out = { all: m.TOOLS.map(t => [t, m.isPaused(t)]), unknown: m.isPaused("qc-control-unknown-tool") };
    if (keep === undefined) delete process.env.REPORTS_PAUSED; else process.env.REPORTS_PAUSED = keep;
    return out;
  };
  const all = load("all"), none = load("0"), one = load("roi");
  rec("F6", "REPORTS_PAUSED=all pauses every report tool", "control", all.all.every(([, p]) => p));
  rec("F6", "REPORTS_PAUSED=roi pauses ROI only (unless paused in code)", "control",
    one.all.find(([t]) => t === "roi")[1] && one.all.filter(([t]) => t !== "roi").every(([t, p]) => p === none.all.find(([u]) => u === t)[1]));
  rec("F6", "An unknown tool name counts as paused", "control", none.unknown && all.unknown);

  // Live: an unknown tool asking for a report must be refused before any AI call.
  const r = await post("/api/synthesize", { purpose: "report", tool: "qc-control-unknown-tool", max_tokens: 1, messages: [{ role: "user", content: "QC control" }] });
  rec("F6", "Control (live): unknown tool's report is refused", "control", r.status === 503, `HTTP ${r.status}`);

  // Live: what the site says is paused right now (recorded, not judged).
  const s = await get("/api/status");
  let paused = "unreadable";
  try { paused = JSON.parse(s.text).pausedTools.join(", ") || "none"; } catch {}
  rec("F6", `Status endpoint answers (paused now: ${paused})`, "check", s.status === 200 && paused !== "unreadable", `HTTP ${s.status}`);
}

// ── P1: patient-info screen ──────────────────────────────────────────────────
const PLANTED = [
  ["a Social Security number", "Patient SSN 123-45-6789 had a result."],
  ["a medical record number", "See MRN: 00482913 for details."],
  ["a date of birth", "DOB: 03/14/1961, presenting with chest pain."],
  ["a patient name", "Patient: Maria Lopez was flagged."],
  ["an accession number", "Accession #A23-004519 was rerun."],
  ["a street address", "She lives at 4120 Moraga Avenue near the clinic."],
];
const CLEAN = "Our committee reviews sepsis alerts monthly and tracks the override rate.";
{
  const { strongHit } = require(join(root, "api/_phi.js"));
  // The browser copy, loaded in a sandbox with a stub page so it can't touch anything.
  const src = readFileSync(join(root, "public/phi-guard.js"), "utf8")
    .replace(/function check\(text, list\) \{/, "globalThis.__check = function (t, l) { return check(t, l); }; globalThis.__STRONG = STRONG; function check(text, list) {");
  const sandbox = { window: { fetch() {}, addEventListener() {} }, document: { addEventListener() {}, querySelectorAll: () => [], readyState: "loading" } };
  sandbox.globalThis = sandbox;
  let browserCheck = null;
  try { vm.runInNewContext(src, sandbox, { timeout: 1000 }); browserCheck = t => sandbox.__check(t, sandbox.__STRONG); } catch (e) {
    rec("P1", "Browser copy of the screen loads", "check", false, String(e.message));
  }
  for (const [what, text] of PLANTED) {
    rec("P1", `Server screen catches ${what}`, "control", strongHit(text), strongHit(text) ? "" : "let it through");
    if (browserCheck) rec("P1", `Browser screen catches ${what}`, "control", browserCheck(text), browserCheck(text) ? "" : "let it through");
    const r = await post("/api/synthesize", { max_tokens: 1, messages: [{ role: "user", content: text }] });
    let flagged = false;
    try { flagged = JSON.parse(r.text).phi === true; } catch {}
    rec("P1", `Live site refuses ${what}`, "control", r.status === 400 && flagged, `HTTP ${r.status}`);
  }
  rec("P1", "Server screen lets ordinary text through", "check", !strongHit(CLEAN), strongHit(CLEAN) || "");
  if (browserCheck) rec("P1", "Browser screen lets ordinary text through", "check", !browserCheck(CLEAN));
}

// ── X2: private endpoints stay locked ────────────────────────────────────────
{
  const s = await get("/api/status");
  rec("X2", "Control: a public endpoint answers (so refusals below are real)", "control", s.status === 200, `HTTP ${s.status}`);
  const locked = [
    ["Review queue, no password", () => get("/api/queue")],
    ["Review queue, wrong password", () => get("/api/queue", { headers: { "x-intake-password": "qc-control-wrong" } })],
    ["Queue export, wrong backup token", () => get("/api/queue?export=1", { headers: { "x-backup-token": "qc-control-wrong" } })],
    ["Clear decision log, no token", () => post("/api/queue", { action: "clear-decisions" })],
    ["Approve a contribution, no password", () => post("/api/queue", { action: "approve", id: "qc-control" })],
    ["Document library (private), no password", () => get("/api/documents")],
    ["Add a document, no password", () => post("/api/documents", { title: "qc-control" })],
  ];
  for (const [name, call] of locked) {
    const r = await call();
    rec("X2", name, "check", r.status === 401 || r.status === 403, `HTTP ${r.status}`);
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
const now = new Date().toISOString();
const checks = results.filter(r => r.kind === "check"), controls = results.filter(r => r.kind === "control");
const pct = a => a.length ? Math.round(1000 * a.filter(r => r.ok).length / a.length) / 10 : 100;
const failed = results.filter(r => !r.ok);
const summary = {
  agent: AGENT, site: SITE, time: now,
  checksPassed: pct(checks), controlsCaught: pct(controls),
  failedSite: failed.filter(r => r.kind === "check").length,
  failedControls: failed.filter(r => r.kind === "control").length,
  results,
};
mkdirSync(join(root, "qc-out"), { recursive: true });
writeFileSync(join(root, "qc-out/site-health.json"), JSON.stringify(summary, null, 2));
writeFileSync(join(root, "qc-out/site-health-runs.csv"),
  `agent,measure,value,time\n${AGENT},Checks passed,${summary.checksPassed},${now}\n${AGENT},Controls caught,${summary.controlsCaught},${now}\n`);

const byId = {};
for (const r of results) (byId[r.id] ||= []).push(r);
for (const [id, rs] of Object.entries(byId)) {
  console.log(`${id}: ${rs.filter(r => r.ok).length}/${rs.length} ok`);
  for (const r of rs.filter(r => !r.ok)) console.log(`  ✗ ${r.kind === "control" ? "[control] " : ""}${r.check}${r.detail ? " — " + r.detail : ""}`);
}
console.log(`\nChecks passed ${summary.checksPassed}% · controls caught ${summary.controlsCaught}%`);
process.exit(failed.length ? 1 : 0);
