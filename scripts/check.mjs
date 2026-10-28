// Commons drift checks. Runs on every pull request (.github/workflows/checks.yml)
// and locally with `npm run check`. No dependencies. Exits 1 if anything fails.
//
// These are the mechanical checks: the internal loop watching the site itself.
// Judgment calls (is a claim still true? is a new node forming?) are for the
// scheduled agents and for Lindsay. See docs/ROADMAP.md.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = p => readFileSync(join(root, p), "utf8");
const json = p => JSON.parse(read(p));

const failures = [];
const warnings = [];
const fail = m => failures.push(m);
const warn = m => warnings.push(m);

const LOOPS = new Set(["internal", "handoff", "external", "commons", "forming"]);
const STATUSES = new Set(["Unknown", "Contested", "Unknowable", null]);
const MAX_AGE_DAYS = 183; // dated layers older than ~6 months fail

// ── Nodes: one source of truth ───────────────────────────────────────────────
const nodes = json("src/data/nodes.json");
const ids = new Set();
for (const n of nodes) {
  if (ids.has(n.id)) fail(`nodes.json: duplicate id "${n.id}"`);
  ids.add(n.id);
  for (const f of ["id", "loop", "label", "icon", "question", "contention", "gap"]) {
    if (!n[f] || typeof n[f] !== "string") fail(`nodes.json: "${n.id}" is missing ${f}`);
  }
  if (!LOOPS.has(n.loop)) fail(`nodes.json: "${n.id}" has unknown loop "${n.loop}"`);
  if (!STATUSES.has(n.status ?? null)) fail(`nodes.json: "${n.id}" has unknown status "${n.status}"`);
  if (typeof n.mandatory !== "boolean") fail(`nodes.json: "${n.id}" mandatory must be true or false`);
  if (!Array.isArray(n.components) || n.components.length === 0) warn(`nodes.json: "${n.id}" has no components`);
  if (!n.evidence?.length) warn(`nodes.json: "${n.id}" has no linked evidence`);
  for (const ev of n.evidence || []) if (!ev.url) warn(`nodes.json: "${n.id}" evidence "${ev.title}" has no link`);
  // Overstatement watch: absolutes that slipped past the Oct 27 review.
  for (const f of ["contention", "gap", "insight"]) {
    const t = n[f] || "";
    const hit = t.match(/\b(almost universally|universally|most institutions|no one|nobody|always|never)\b/i);
    if (hit && !/Commons position/i.test(t)) warn(`nodes.json: "${n.id}" ${f} says "${hit[0]}" with no source or Commons position label`);
  }
}

// ── Map: every node has a place ──────────────────────────────────────────────
const map = json("src/data/map-layout.json");
const layout = map.layouts?.[map.layout];
if (!layout) fail(`map-layout.json: active layout "${map.layout}" not found`);
else {
  for (const id of ids) if (!layout[id]) fail(`map-layout.json: node "${id}" has no position on the map`);
  for (const id of Object.keys(layout)) if (!ids.has(id)) fail(`map-layout.json: position for unknown node "${id}"`);
  for (const [id, p] of Object.entries(layout)) {
    if (p.x < 0 || p.x > 100 || p.y < 0 || p.y > 100) fail(`map-layout.json: "${id}" is off the map (${p.x}, ${p.y})`);
  }
}

// ── Regulatory layer and toolbox cover every node ────────────────────────────
const reg = json("src/data/regulatory.json");
for (const id of ids) if (!reg.nodes[id]) fail(`regulatory.json: no entry for node "${id}"`);
const ageDays = (Date.now() - Date.parse(reg.asOf)) / 86400000;
if (!(ageDays >= 0)) fail(`regulatory.json: asOf "${reg.asOf}" is not a valid date`);
else if (ageDays > MAX_AGE_DAYS) fail(`regulatory.json: last reviewed ${Math.round(ageDays)} days ago (limit ${MAX_AGE_DAYS})`);
else if (ageDays > MAX_AGE_DAYS - 30) warn(`regulatory.json: review due within a month (reviewed ${reg.asOf})`);
for (const [id, layers] of Object.entries(reg.nodes)) {
  for (const k of ["required", "recommended", "practiced"]) {
    for (const it of layers[k] || []) if (!it.verified) warn(`regulatory.json: "${id}" ${k} item unverified: ${it.text.slice(0, 60)}`);
  }
}

const tb = json("src/data/toolbox.json");
for (const id of ids) {
  const keys = tb.byNode[id];
  if (!keys) fail(`toolbox.json: no entry for node "${id}"`);
  else if (keys.length === 0) warn(`toolbox.json: node "${id}" has no tools`);
  for (const k of keys || []) if (!tb.tools[k]) fail(`toolbox.json: node "${id}" uses unknown tool "${k}"`);
}

// ── Internal links resolve ───────────────────────────────────────────────────
const rewrites = json("vercel.json").rewrites || [];
const spaRoutes = [/^\/$/, /^\/nodes\/[\w-]+$/];
function resolves(href) {
  const path = href.split("#")[0].split("?")[0];
  if (!path || path === "/") return true;
  if (spaRoutes.some(r => r.test(path))) {
    const m = path.match(/^\/nodes\/([\w-]+)$/);
    return !m || ids.has(m[1]);
  }
  if (rewrites.some(r => r.source === path)) return true;
  const file = join(root, "public", path);
  if (existsSync(file) && statSync(file).isFile()) return true;
  if (existsSync(join(file, "index.html"))) return true;
  return false;
}
function walk(dir) {
  return readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const sources = [
  ...walk(join(root, "public")).filter(p => p.endsWith(".html")),
  ...walk(join(root, "src")).filter(p => /\.(jsx|json)$/.test(p)),
];
for (const file of sources) {
  const text = readFileSync(file, "utf8");
  const rel = file.slice(root.length);
  for (const m of text.matchAll(/(?:href=|url:\s*|"url":\s*)["'`](\/[^"'`$\s{]*)["'`]/g)) {
    if (!resolves(m[1])) fail(`${rel}: link to ${m[1]} goes nowhere`);
  }
}

// ── Vercel Hobby plan: at most 12 server functions ───────────────────────────
const fnCount = readdirSync(join(root, "api")).filter(f => f.endsWith(".js") && !f.startsWith("_")).length;
if (fnCount > 12) fail(`api/: ${fnCount} server functions; the Vercel Hobby plan allows 12. Merge routes or move shared code into _files.`);
else if (fnCount > 10) warn(`api/: ${fnCount} of 12 server functions used`);

// ── Report ───────────────────────────────────────────────────────────────────
for (const w of warnings) console.log(`warn  ${w}`);
for (const f of failures) console.log(`FAIL  ${f}`);
console.log(`\n${nodes.length} nodes · ${failures.length} failures · ${warnings.length} warnings`);
process.exit(failures.length ? 1 : 0);
