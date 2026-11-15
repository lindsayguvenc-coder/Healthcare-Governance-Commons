// PR guards: batch 2 of the Site QC crosswalk. Runs on every pull request and
// push to main (.github/workflows/checks.yml), and locally with
// `node scripts/pr-guards.mjs`. No dependencies. Exits 1 on any failure.
//
//   S1  every page that makes a report loads the shared disclaimer and shows it
//       (and puts it in the PDF, if the page builds one)
//   P2  every storage key (server database and visitor's browser) is listed in
//       docs/privacy-inventory.json; unlisted ones fail, listed ones the privacy
//       notice doesn't mention yet are warnings
//   P4  every outside domain a page loads from is listed there too
//   X1  no API keys, tokens or private keys in tracked files
//
// Each detector is first run on planted cases with a known answer (seeded
// controls). If a control isn't caught, the detector is broken and the run fails
// even if the code is clean.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { execSync } from "node:child_process";

const root = new URL("..", import.meta.url).pathname;
const read = p => readFileSync(join(root, p), "utf8");
const failures = [], warnings = [], controls = [];
const fail = (id, m) => failures.push(`${id} ${m}`);
const warn = (id, m) => warnings.push(`${id} ${m}`);
const control = (id, name, caught) => { controls.push({ id, name, caught }); if (!caught) fail(id, `[control] ${name} was not caught: the check is broken`); };

function walk(dir, exts, out = []) {
  for (const f of readdirSync(join(root, dir))) {
    const p = join(dir, f);
    if (["node_modules", "dist", ".git", "qc-out"].includes(f)) continue;
    if (statSync(join(root, p)).isDirectory()) walk(p, exts, out);
    else if (exts.some(e => f.endsWith(e))) out.push(p);
  }
  return out;
}

// ── S1: disclaimer on every report ───────────────────────────────────────────
function disclaimerProblems(html) {
  const makesReport = /purpose:\s*['"]report['"]|\/api\/generate-protocol/.test(html);
  const makesPdf = /jspdf/i.test(html);
  if (!makesReport && !makesPdf) return [];
  const p = [];
  if (!/<script[^>]+src=["']\/report-disclaimer\.js["']/.test(html)) p.push("makes a report but doesn't load /report-disclaimer.js");
  if (!/CommonsDisclaimer\.html\(/.test(html)) p.push("makes a report but never shows CommonsDisclaimer.html()");
  if (makesPdf && !/CommonsDisclaimer\.pdf(Block|Footer)\(/.test(html)) p.push("builds a PDF without CommonsDisclaimer.pdfBlock() or pdfFooter()");
  return p;
}
control("S1", "a planted report page with no disclaimer",
  disclaimerProblems(`<script>fetch("/api/synthesize",{body:JSON.stringify({purpose:"report"})})</script>`).length === 2);
control("S1", "a planted PDF page with an on-screen disclaimer only",
  disclaimerProblems(`<script src="/report-disclaimer.js"></script><script>purpose: "report"; CommonsDisclaimer.html({}); new jspdf.jsPDF()</script>`).length === 1);
const pages = walk("public", [".html"]).concat(["index.html"]);
for (const p of pages) for (const why of disclaimerProblems(read(p))) fail("S1", `${p}: ${why}`);

// ── P2 / P4: storage keys and outside domains vs the inventory ───────────────
const inv = JSON.parse(read("docs/privacy-inventory.json"));
const globRe = g => new RegExp("^" + g.split("*").map(s => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$");
const redisListed = inv.redisKeys.map(k => ({ ...k, re: globRe(k.pattern) }));

function redisKeys(src) {
  const out = new Set();
  // constants like PENDING_KEY = "suggest:pending" and key builders like k => `suggest:approved:${id}`
  for (const m of src.matchAll(/\b[A-Z_]*KEY\s*=\s*["'`]([^"'`]+)["'`]/g)) out.add(m[1]);
  for (const m of src.matchAll(/=>\s*`([a-z_]+:[^`]*)`/g)) out.add(m[1]);
  // literal keys passed straight to the database client, and `const key = ...` templates
  for (const m of src.matchAll(/client\.\w+\(\s*["'`]([^"'`]+)["'`]/g)) out.add(m[1]);
  for (const m of src.matchAll(/\bkey\s*=\s*`([^`]+)`/g)) out.add(m[1]);
  return [...out].map(k => k.replace(/\$\{[^}]*\}/g, "*")).filter(k => /^[\w:*.-]+$/.test(k));
}
const redisUnlisted = keys => keys.filter(k => !redisListed.some(l => l.re.test(k) || l.pattern === k));
control("P2", "a planted new database key", redisUnlisted(redisKeys(`await client.set("qc-control:new-key", 1)`)).length === 1);
control("P2", "a planted key built from a template", redisUnlisted(redisKeys("const key = `qc-control:visitor:${ip}`;")).length === 1);

function browserKeys(src) {
  return [...src.matchAll(/(?:localStorage|sessionStorage)\.(?:setItem|getItem|removeItem)\(\s*["'`]([^"'`]+)["'`]/g)].map(m => m[1]);
}
const browserUnlisted = keys => keys.filter(k => !inv.browserStorage.some(b => b.key === k));
control("P2", "a planted new browser storage key", browserUnlisted(browserKeys(`localStorage.setItem("qc-control.key","x")`)).length === 1);

function outsideDomains(src) {
  const out = new Set();
  const pats = [
    /<(?:script|img|iframe|source|video|audio|embed)[^>]+src=["'](?:https?:)?\/\/([^/"']+)/gi,
    /<link[^>]+href=["'](?:https?:)?\/\/([^/"']+)/gi,
    /@import\s+url\(\s*["']?(?:https?:)?\/\/([^/"')]+)/gi,
    /\.src\s*=\s*["'](?:https?:)?\/\/([^/"']+)/gi,
    /\bfetch\(\s*["'`]https?:\/\/([^/"'`]+)/gi,
    /\burl\(\s*["']?https?:\/\/([^/"')]+)/gi,
  ];
  for (const re of pats) for (const m of src.matchAll(re)) out.add(m[1].toLowerCase());
  return [...out];
}
const domainUnlisted = ds => ds.filter(d => !inv.outsideDomains.some(o => o.domain === d));
control("P4", "a planted outside tracking script", domainUnlisted(outsideDomains(`<script async src="https://qc-control-tracker.example/t.js"></script>`)).length === 1);
control("P4", "a planted script loaded from code", domainUnlisted(outsideDomains(`s.src = "https://qc-control-cdn.example/lib.js";`)).length === 1);

const code = walk("api", [".js"]).concat(walk("public", [".html", ".js"]), walk("src", [".js", ".jsx"]), ["index.html"]);
const seen = { redis: new Set(), browser: new Set(), domains: new Set() };
for (const f of code) {
  const src = read(f);
  if (f.startsWith("api")) for (const k of redisKeys(src)) { seen.redis.add(k); if (redisUnlisted([k]).length) fail("P2", `${f}: database key "${k}" isn't in docs/privacy-inventory.json`); }
  for (const k of browserKeys(src)) { seen.browser.add(k); if (browserUnlisted([k]).length) fail("P2", `${f}: browser storage key "${k}" isn't in docs/privacy-inventory.json`); }
  for (const d of outsideDomains(src)) { seen.domains.add(d); if (domainUnlisted([d]).length) fail("P4", `${f}: loads from ${d}, which isn't in docs/privacy-inventory.json`); }
}
// Stale lines: everything listed must still be in the code, and every notice
// line it points to must really be in the privacy notice.
const noticeText = read("public/privacy/index.html").replace(/<[^>]+>/g, " ").replace(/&#39;|&rsquo;/g, "'").replace(/\s+/g, " ");
const staleRedis = (listed, seenKeys) => listed.filter(l => ![...seenKeys].some(k => l.re.test(k) || l.pattern === k));
control("P2", "a planted inventory entry for a key the code no longer uses",
  staleRedis([{ pattern: "qc-control:gone", re: globRe("qc-control:gone") }], new Set(["suggest:pending"])).length === 1);
control("P2", "a planted notice line that isn't in the privacy notice", !noticeText.includes("QC control line that is not in the notice"));
for (const l of staleRedis(redisListed, seen.redis)) fail("P2", `"${l.pattern}" is in the inventory but no longer in the code: take its line out of the privacy notice and docs/privacy-inventory.json`);
for (const b of inv.browserStorage) if (!seen.browser.has(b.key)) fail("P2", `browser key "${b.key}" is in the inventory but no longer in the code: take its line out of the privacy notice and the inventory`);
for (const o of inv.outsideDomains) if (!seen.domains.has(o.domain)) fail("P4", `${o.domain} is in the inventory but nothing loads from it now: take it out of the privacy notice and the inventory`);
for (const x of [...inv.redisKeys, ...inv.browserStorage, ...inv.outsideDomains])
  if (x.notice && !noticeText.includes(x.notice)) fail("P2", `inventory says the privacy notice covers ${x.pattern || x.key || x.domain} with "${x.notice}", but that text isn't in the notice`);

for (const k of inv.redisKeys) if (!k.notice) warn("P2", `database key "${k.pattern}" (${k.what}) isn't mentioned in the privacy notice`);
for (const k of inv.browserStorage) if (!k.notice) warn("P2", `browser storage "${k.key}" (${k.what}) isn't mentioned in the privacy notice`);
for (const d of inv.outsideDomains) if (!d.notice) warn("P4", `outside domain ${d.domain} (${d.what}) isn't mentioned in the privacy notice`);
// The rate limiter must never key on a raw network address: the notice promises a scrambled one.
for (const f of walk("api", [".js"])) {
  const src = read(f);
  if (/ratelimit:[^`]*\$\{clientIp\(req\)\}/.test(src)) fail("P2", `${f}: a rate-limit key holds the raw network address; the privacy notice says it's scrambled`);
}
control("P2", "a planted raw-address rate-limit key", /ratelimit:[^`]*\$\{clientIp\(req\)\}/.test("const key = `ratelimit:x:${clientIp(req)}:1`;"));

// ── X1: no secrets in tracked files ──────────────────────────────────────────
const SECRET = [
  [/sk-ant-[A-Za-z0-9_-]{20,}/, "an Anthropic API key"],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}/, "a GitHub token"],
  [/github_pat_[A-Za-z0-9_]{30,}/, "a GitHub token"],
  [/\bAKIA[0-9A-Z]{16}\b/, "an AWS access key"],
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, "a private key"],
  [/rediss?:\/\/[^\s:"'`@]*:[^\s@"'`]{8,}@/, "a database URL with its password"],
  [/\bxox[baprs]-[A-Za-z0-9-]{20,}/, "a Slack token"],
];
const secretIn = s => (SECRET.find(([re]) => re.test(s)) || [])[1] || null;
// Planted secrets are assembled at run time, so this file never trips its own check.
control("X1", "a planted Anthropic key", secretIn("key = '" + "sk-" + "ant-" + "api03-" + "x".repeat(40) + "'") === "an Anthropic API key");
control("X1", "a planted private key", secretIn("-----BEGIN " + "PRIVATE KEY-----") === "a private key");
control("X1", "a planted database password", secretIn("redis://default:" + "s3cretpassw0rd" + "@host:6379") !== null);
let tracked = [];
try { tracked = execSync("git ls-files", { cwd: root }).toString().split("\n").filter(Boolean); }
catch { tracked = walk(".", [".js", ".mjs", ".jsx", ".json", ".html", ".md", ".yml", ".py", ".env"]).map(p => relative(".", p)); }
for (const f of tracked) {
  if (/\.(pdf|png|jpg|jpeg|gif|ico|woff2?|zip)$/i.test(f)) continue;
  let s; try { s = read(f); } catch { continue; }
  const hit = secretIn(s);
  if (hit) fail("X1", `${f}: looks like it contains ${hit}`);
}

// ── Report ───────────────────────────────────────────────────────────────────
const caught = controls.filter(c => c.caught).length;
console.log(`PR guards: ${pages.length} pages, ${seen.redis.size} database keys, ${seen.browser.size} browser keys, ${seen.domains.size} outside domains, ${tracked.length} files scanned; controls caught ${caught}/${controls.length}`);
for (const w of warnings) console.log(`  ! ${w}`);
for (const f of failures) console.log(`  ✗ ${f}`);
if (failures.length) { console.log(`\n${failures.length} failure(s).`); process.exit(1); }
console.log("All PR guards pass.");
