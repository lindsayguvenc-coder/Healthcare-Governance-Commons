// Weekly site checks: batch 3 of the Site QC crosswalk (the parts that need no
// browser). Runs from .github/workflows/site-weekly.yml, and locally with:
//   SITE=http://localhost:4300 LOCAL=http://localhost:3000 node scripts/site-weekly.mjs
//
//   F3  outside links still work (library, data files, pages)
//   F4  the Validation Protocol Generator gives the same protocol for a fixed
//       test case: live site vs this repo vs the saved fingerprint
//   C2  every "as of" date is inside its check-by window
//   X3  no high or critical known holes in the site's packages
//   S3  the two AI contribution reviewers: agreement and override rates
//   O4  no commits stranded on a branch after its pull request merged
//
// Seeded controls ride along with each check, as in site-health.mjs.
// Writes qc-out/site-weekly.json and qc-out/site-weekly-runs.csv. Exits 1 on a
// failure; warnings (couldn't check, due soon) don't fail the run.

import { readFileSync, readdirSync, statSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";

const root = new URL("..", import.meta.url).pathname;
const read = p => readFileSync(join(root, p), "utf8");
const SITE = (process.env.SITE || "https://healthcare-governance-commons.vercel.app").replace(/\/$/, "");
const LOCAL = process.env.LOCAL ? process.env.LOCAL.replace(/\/$/, "") : null; // repo copy of the API, for F4
const AGENT = "Site checks (weekly)";
const results = []; // {id, check, kind, level:'ok'|'warn'|'fail', detail}
const rec = (id, check, kind, level, detail = "") => results.push({ id, check, kind, level, ok: level !== "fail", detail });
const pass = (id, check, kind, cond, detail = "") => rec(id, check, kind, cond ? "ok" : "fail", cond ? "" : detail);

function walk(dir, exts, out = []) {
  for (const f of readdirSync(join(root, dir))) {
    const p = join(dir, f);
    if (["node_modules", "dist", ".git", "qc-out", "fonts", "vendor"].includes(f)) continue;
    if (statSync(join(root, p)).isDirectory()) walk(p, exts, out);
    else if (exts.some(e => f.endsWith(e))) out.push(p);
  }
  return out;
}

// ── F3: outside links ────────────────────────────────────────────────────────
// Dead = the server says the page is gone (404, 410) or the name doesn't resolve.
// Many sites refuse robots (401, 403, 429, 5xx): those are "couldn't check",
// a warning, never a failure, so the check doesn't cry wolf.
async function probe(url) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
  try {
    let r = await fetch(url, { method: "HEAD", redirect: "follow", signal: ctl.signal, headers: { "user-agent": "Mozilla/5.0 (Commons link check; +https://healthcare-governance-commons.vercel.app)" } });
    // Some servers answer HEAD wrongly (404 or 405 for a page that's there), so
    // anything but a clean success is confirmed with a real GET.
    if (r.status >= 400) r = await fetch(url, { method: "GET", redirect: "follow", signal: ctl.signal, headers: { "user-agent": "Mozilla/5.0 (Commons link check)", accept: "text/html,application/pdf,*/*" } });
    return { status: r.status, finalUrl: r.url };
  } catch (e) { return { status: 0, error: String(e.cause?.code || e.name || e.message) }; }
  finally { clearTimeout(t); }
}
const verdict = p => (p.status === 404 || p.status === 410 || ["ENOTFOUND", "EAI_AGAIN_PERMANENT"].includes(p.error)) ? "dead"
  : (p.status >= 200 && p.status < 400) ? "ok" : "unknown";
{
  const urls = new Map(); // url -> first file it's in
  const skip = /localhost|example\.(com|org)|w3\.org\/(2000|1999)|schemas\.|healthcare-governance-commons\.vercel\.app|api\.anthropic\.com|fonts\.g/;
  for (const f of walk("src/data", [".json"]).concat(walk("public", [".html"]), walk("src", [".jsx"]))) {
    for (const m of read(f).matchAll(/https?:\/\/[^\s"'<>`)\]\\]+/g)) {
      const u = m[0].replace(/[.,;:]+$/, "").replace(/&amp;/g, "&");
      if (!skip.test(u) && !urls.has(u)) urls.set(u, f);
    }
  }
  const c = await probe(`${SITE}/api/qc-control-dead-link-${Date.now()}`);
  pass("F3", "Control: a known-dead link is reported dead", "control", verdict(c) === "dead", `got ${c.status || c.error}`);
  const list = [...urls.entries()];
  const out = [];
  for (let i = 0; i < list.length; i += 8) out.push(...await Promise.all(list.slice(i, i + 8).map(async ([u, f]) => [u, f, await probe(u)])));
  // If no outside link answered at all, the runner's network is down: that's
  // "couldn't check", not 60 dead links.
  // A sandbox or proxy can block most names: if over half the links fail with
  // the same network error, treat the run as unable to check rather than dead.
  const errs = out.filter(([, , p]) => p.error).map(([, , p]) => p.error);
  const top = errs.length ? Math.max(...[...new Set(errs)].map(e => errs.filter(x => x === e).length)) : 0;
  const networkUp = out.some(([, , p]) => p.status > 0) && top <= out.length / 2;
  if (!networkUp && out.length) rec("F3", "Outside links couldn't be checked: most outside sites didn't answer (network blocked on the runner?)", "check", "warn", out[0][2].error || "");
  let dead = 0, unknown = 0;
  for (const [u, f, p] of out) {
    const v = networkUp ? verdict(p) : "unknown";
    if (!networkUp) { unknown++; continue; }
    if (v === "dead") { dead++; rec("F3", `Dead link in ${f}: ${u}`, "check", "fail", `${p.status || p.error}`); }
    else if (v === "unknown") { unknown++; rec("F3", `Couldn't check ${u}`, "check", "warn", `${p.status || p.error} (site may block robots)`); }
    else if (new URL(p.finalUrl).hostname !== new URL(u).hostname) rec("F3", `Moved: ${u} → ${p.finalUrl}`, "check", "warn", "update the link if the new place is right");
  }
  rec("F3", `${out.length} outside links: ${out.length - dead - unknown} work, ${dead} dead, ${unknown} couldn't be checked`, "check", "ok");
}

// ── F4: Validation Protocol Generator, fixed test case ───────────────────────
const VPG_CASE = JSON.parse(read("tests/site-qc/vpg-case.json"));
function strip(x) {
  if (Array.isArray(x)) return x.map(strip);
  if (x && typeof x === "object") return Object.fromEntries(Object.keys(x).sort().filter(k => k !== "generatedAt").map(k => [k, strip(x[k])]));
  return x;
}
const fingerprint = p => createHash("sha256").update(JSON.stringify(strip(p))).digest("hex").slice(0, 16);
async function protocolFrom(base, answers) {
  try {
    const r = await fetch(`${base}/api/generate-protocol`, { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify({ answers }) });
    const j = await r.json().catch(() => ({}));
    return r.status === 200 && j.protocol ? { p: j.protocol } : { err: `HTTP ${r.status}${j.error ? ": " + j.error : ""}` };
  } catch (e) { return { err: String(e.message) }; }
}
{
  const goldenFile = "tests/site-qc/vpg-golden.json";
  const golden = existsSync(join(root, goldenFile)) ? JSON.parse(read(goldenFile)) : null;
  const live = await protocolFrom(SITE, VPG_CASE.answers);
  const local = LOCAL ? await protocolFrom(LOCAL, VPG_CASE.answers) : null;
  if (live.err && /paused/i.test(live.err)) rec("F4", "Validation Protocol Generator is paused on the live site, so it wasn't tested", "check", "warn", live.err);
  else if (live.err) rec("F4", "Validation Protocol Generator answers the fixed test case", "check", "fail", live.err);
  else {
    const p = live.p, fpLive = fingerprint(p);
    const need = ["summary", "meta", "sections", "allGapFlags"].filter(k => !(k in p));
    pass("F4", "Protocol has its required parts", "check", need.length === 0, `missing: ${need.join(", ")}`);
    pass("F4", "Protocol carries its as-of line", "check", JSON.stringify(p).includes("as of"), "no as-of wording found");
    // Engine calls that fail are folded into the protocol quietly; say so loudly.
    const engineErrors = [];
    (function walk(x, path) {
      if (x && typeof x === "object") {
        if (x.error === true && (x.url || x.status || x.message)) engineErrors.push(`${path}: ${x.status || x.message || "error"} from ${x.url || "?"}`);
        for (const k of Object.keys(x)) walk(x[k], path + "." + k);
      }
    })(p, "protocol");
    pass("F4", "Protocol was built with all its engines answering", "check", engineErrors.length === 0, engineErrors.slice(0, 3).join("; "));
    const fpLocal = local && !local.err ? fingerprint(local.p) : null;
    // keep both protocols with the run, so a difference can be read, not guessed at
    mkdirSync(join(root, "qc-out"), { recursive: true });
    writeFileSync(join(root, "qc-out/vpg-live.json"), JSON.stringify(strip(p), null, 1));
    if (local && !local.err) writeFileSync(join(root, "qc-out/vpg-repo.json"), JSON.stringify(strip(local.p), null, 1));
    if (fpLocal && fpLocal !== fpLive) {
      const parts = o => Object.fromEntries(Object.keys(o || {}).map(k => [k, fingerprint(o[k])]));
      const a = parts(p), b = parts(local.p);
      const secA = Object.fromEntries((p.sections || []).map(x => [x.title, fingerprint(x)]));
      const secB = Object.fromEntries((local.p.sections || []).map(x => [x.title, fingerprint(x)]));
      const diff = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => k !== "sections" && a[k] !== b[k])
        .concat([...new Set([...Object.keys(secA), ...Object.keys(secB)])].filter(k => secA[k] !== secB[k]).map(k => `section "${k}"`));
      rec("F4", `Where live and repo differ: ${diff.join(", ") || "(nowhere at the top level)"}`, "check", "warn");
    }
    if (local?.err) rec("F4", "Repo copy of the generator answers", "check", "warn", local.err);
    if (!golden) rec("F4", "No saved fingerprint yet", "check", "warn", `live is ${fpLive}; save it in ${goldenFile}`);
    else if (fpLive === golden.fingerprint) rec("F4", "Live protocol matches the saved fingerprint", "check", "ok");
    else if (fpLocal && fpLocal === fpLive) rec("F4", "Protocol changed with the code; the saved fingerprint is out of date", "check", "warn", `update ${goldenFile} to ${fpLive} after checking the change was meant`);
    else if (fpLocal) rec("F4", "Live protocol differs from what this repo's code produces", "check", "fail", `live ${fpLive}, repo ${fpLocal}, saved ${golden.fingerprint}: the deployed site isn't running main, or something else changed it`);
    else rec("F4", "Live protocol differs from the saved fingerprint", "check", "fail", `live ${fpLive}, saved ${golden.fingerprint}`);
    // control: one changed answer must change the fingerprint, or the comparison is blind
    const moved = await protocolFrom(SITE, { ...VPG_CASE.answers, ...VPG_CASE.control });
    pass("F4", "Control: a changed answer changes the protocol", "control", moved.p && fingerprint(moved.p) !== fpLive, moved.err || "same fingerprint");
  }
}

// ── C2: as-of dates ──────────────────────────────────────────────────────────
const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December";
const WARN_DAYS = 90, FAIL_DAYS = 183;
function asOfDates(src) {
  const out = [];
  for (const m of src.matchAll(/\b[A-Z_]*AS_OF\s*=\s*["'`]([^"'`]+)["'`]/g)) out.push(m[1]);
  for (const m of src.matchAll(/"asOf"\s*:\s*"(\d{4}-\d{2}-\d{2})"/g)) out.push(m[1]);
  for (const m of src.matchAll(new RegExp(`\\bas of (?:(?:${MONTHS}) \\d{1,2}, \\d{4}|\\d{4}-\\d{2}-\\d{2})`, "gi"))) out.push(m[0].slice(6));
  return out.map(s => [s, Date.parse(s.replace(/^(\w+ \d{1,2}, \d{4}).*/, "$1"))]).filter(([, t]) => !isNaN(t));
}
const ageDays = t => Math.floor((Date.now() - t) / 86400000);
{
  const planted = asOfDates(`const OLD_AS_OF = "January 2, 2020";`);
  pass("C2", "Control: a planted out-of-date as-of is caught", "control", planted.length === 1 && ageDays(planted[0][1]) > FAIL_DAYS);
  const seen = new Map();
  for (const f of walk("api", [".js"]).concat(walk("src/data", [".json"]), walk("public", [".html", ".js"]))) {
    for (const [s, t] of asOfDates(read(f))) { const k = `${f}|${s}`; if (!seen.has(k)) seen.set(k, [f, s, t]); }
  }
  let n = 0;
  for (const [f, s, t] of seen.values()) {
    n++; const d = ageDays(t);
    if (d > FAIL_DAYS) rec("C2", `${f}: "as of ${s}" is ${d} days old`, "check", "fail", "re-check the source and update the date");
    else if (d > WARN_DAYS) rec("C2", `${f}: "as of ${s}" is ${d} days old`, "check", "warn", `re-check within ${FAIL_DAYS - d} days`);
  }
  rec("C2", `${n} as-of dates found`, "check", "ok");
}

// ── X3: known holes in packages ──────────────────────────────────────────────
{
  try {
    let raw;
    try { raw = execSync("npm audit --json --omit=dev", { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString(); }
    catch (e) { raw = e.stdout?.toString() || ""; } // npm audit exits 1 when it finds something
    const a = JSON.parse(raw);
    const v = a.metadata?.vulnerabilities || {};
    const bad = (v.high || 0) + (v.critical || 0);
    if (!a.metadata) rec("X3", "Package audit ran", "check", "warn", a.error?.summary || "no audit data (is package-lock.json present?)");
    else pass("X3", `Packages: ${bad} high or critical, ${v.moderate || 0} moderate, ${v.low || 0} low`, "check", bad === 0, "run npm audit for details");
  } catch (e) { rec("X3", "Package audit ran", "check", "warn", String(e.message).slice(0, 120)); }
}

// ── S3: contribution reviewers (from the weekly backup archive) ──────────────
{
  const decisions = [];
  try {
    execSync("git fetch -q origin data-archive:refs/remotes/origin/data-archive", { cwd: root, stdio: "ignore" });
    const files = execSync("git ls-tree -r --name-only origin/data-archive", { cwd: root }).toString().split("\n").filter(f => /^archive\/\d{4}-\d{2}-\d{2}\.json$/.test(f));
    for (const f of files) {
      const d = JSON.parse(execSync(`git show origin/data-archive:${f}`, { cwd: root, maxBuffer: 1 << 26 }).toString());
      decisions.push(...(d.decisions || []));
    }
  } catch (e) { rec("S3", "Read the review archive", "check", "warn", String(e.message).slice(0, 120)); }
  const judged = decisions.filter(d => d.fit && d.skeptic && d.final && d.final !== "unpublish");
  const MIN = 20;
  if (judged.length < MIN) rec("S3", `Reviewer agreement: ${judged.length} decisions so far, too few to judge (need ${MIN})`, "check", "ok");
  else {
    const agree = judged.filter(d => d.fit === d.skeptic).length / judged.length;
    const both = judged.filter(d => d.consensus === "approve" || d.consensus === "reject");
    const override = both.length ? both.filter(d => d.overrode).length / both.length : 0;
    rec("S3", `Reviewers agree on ${Math.round(agree * 100)}% of ${judged.length}; you overrode their joint call ${Math.round(override * 100)}% of the time`, "check", override > 0.25 ? "warn" : "ok",
      override > 0.25 ? "you overrode more than 1 in 4 joint calls: the reviewers may be drifting from your judgment" : "");
  }
}

// ── O4: stranded commits ─────────────────────────────────────────────────────
// A commit pushed to a pull request's branch after the PR was merged never
// reaches main. Happened twice on Nov 14, 2026. Compare each recently merged
// PR's branch with the commit that was merged. (Checked against the two real
// cases, PRs #58 and #59, before their branches were cleaned up.)
{
  const repo = process.env.GITHUB_REPOSITORY || "lindsayguvenc-coder/Healthcare-Governance-Commons";
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const api = async (path) => {
    const r = await fetch(`https://api.github.com/repos/${repo}/${path}`, { headers: { accept: "application/vnd.github+json", ...(token ? { authorization: `Bearer ${token}` } : {}) } });
    if (!r.ok) throw new Error(`GitHub ${r.status}`);
    return r.json();
  };
  try {
    const prs = (await api("pulls?state=closed&per_page=50")).filter(p => p.merged_at && Date.now() - Date.parse(p.merged_at) < 60 * 86400000);
    let stranded = 0;
    for (const pr of prs) {
      let head;
      try { head = (await api(`branches/${encodeURIComponent(pr.head.ref)}`)).commit.sha; } catch { continue; } // branch deleted: nothing stranded
      if (head === pr.head.sha) continue;
      const cmp = await api(`compare/${pr.base.ref}...${head}`);
      if (cmp.ahead_by > 0) { stranded++; rec("O4", `PR #${pr.number} (${pr.head.ref}): ${cmp.ahead_by} commit(s) pushed after it merged never reached ${pr.base.ref}`, "check", "fail", "open a PR for that branch, or delete it if the commits aren't wanted"); }
    }
    rec("O4", `${prs.length} recently merged PRs checked for stranded commits: ${stranded} found`, "check", "ok");
  } catch (e) { rec("O4", "Checked for stranded commits", "check", "warn", String(e.message)); }
}

// ── Report ───────────────────────────────────────────────────────────────────
const now = new Date().toISOString();
const failed = results.filter(r => r.level === "fail"), warned = results.filter(r => r.level === "warn");
const controls = results.filter(r => r.kind === "control");
const summary = {
  agent: AGENT, site: SITE, time: now,
  failedSite: failed.filter(r => r.kind === "check").length,
  failedControls: failed.filter(r => r.kind === "control").length,
  warnings: warned.length,
  controlsCaught: controls.length ? Math.round(1000 * controls.filter(r => r.ok).length / controls.length) / 10 : 100,
  results,
};
mkdirSync(join(root, "qc-out"), { recursive: true });
writeFileSync(join(root, "qc-out/site-weekly.json"), JSON.stringify(summary, null, 2));
writeFileSync(join(root, "qc-out/site-weekly-runs.csv"),
  `agent,measure,value,time\n${AGENT},Failures,${failed.length},${now}\n${AGENT},Warnings,${warned.length},${now}\n${AGENT},Controls caught,${summary.controlsCaught},${now}\n`);
const ids = [...new Set(results.map(r => r.id))];
for (const id of ids) {
  const rs = results.filter(r => r.id === id);
  console.log(`${id}: ${rs.filter(r => r.level === "fail").length} failed, ${rs.filter(r => r.level === "warn").length} warnings`);
  for (const r of rs) if (r.level !== "ok" || r.kind === "control") console.log(`  ${r.level === "fail" ? "✗" : r.level === "warn" ? "!" : "✓"} ${r.kind === "control" ? "[control] " : ""}${r.check}${r.detail ? " — " + r.detail : ""}`);
  for (const r of rs) if (r.level === "ok" && r.kind === "check" && /found|links:|Reviewer|Packages|matches|checked for/.test(r.check)) console.log(`  · ${r.check}`);
}
process.exit(failed.length ? 1 : 0);
