// Real runs of the Transition tools (Unpacker, Container Health Check, Charter Starter): the real page, the real relay (api/_relay.js), and
// the real model. Made-up organizations only. Needs ANTHROPIC_API_KEY in the
// environment (use a short-lived, spend-capped key and delete it after).
// The report pause is stubbed off for this local run only.
// Usage: ANTHROPIC_API_KEY=... node real-roi.js <repo> <outDir> [path-to-chrome]
const http = require("http");
const fs = require("fs");
const path = require("path");
const Module = require("module");
const { chromium } = require("playwright");

const repo = path.resolve(process.argv[2]);
const out = path.resolve(process.argv[3]);
const chrome = process.argv[4];
fs.mkdirSync(out, { recursive: true });
if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY not set"); process.exit(1); }

// No Redis here: give the relay a stub module (rate limiting fails open without REDIS_URL).
const stub = path.join(out, "ioredis-stub.js");
fs.writeFileSync(stub, "module.exports = function Redis() {};");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) {
  if (req === "ioredis") return stub;
  return origResolve.call(this, req, ...rest);
};
const pauseFile = path.join(repo, "api/_pause.js");
require.cache[pauseFile] = { id: pauseFile, filename: pauseFile, loaded: true,
  exports: { TOOLS: ["vpg", "roi", "transition"], pausedTools: () => [], isPaused: () => false } };
const { relay } = require(path.join(repo, "api/_relay.js"));

const pub = path.join(repo, "public");
const types = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".json": "application/json", ".svg": "image/svg+xml" };
const log = [];
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host}`);
  if (u.pathname === "/api/synthesize") {
    let raw = ""; for await (const c of req) raw += c;
    req.body = JSON.parse(raw);
    const started = Date.now();
    const shim = { code: 200, status(c) { this.code = c; return this; },
      json(o) { log.push({ ms: Date.now() - started, status: this.code, stop: o.stop_reason, usage: o.usage, blocks: (o.content || []).map(b => b.type),
          text: (o.content || []).filter(b => b.type === "text").map(b => b.text).join("") });
        res.writeHead(this.code, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); } };
    return relay(req, shim);
  }
  if (u.pathname === "/api/status") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end('{"pausedTools":[],"reportsPaused":false}'); }
  let f = path.join(pub, decodeURIComponent(u.pathname));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!f.startsWith(pub) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});


const ONLY = process.env.ONLY;
const RUNS_ALL = [
  { tool: "unpack", name: "unpack-sepsis-override",
    fill: { "#disagreement-input": "On our medical floor, night charge nurses want permission to silence the sepsis alert for patients they've already assessed, because it fires constantly. The quality director says the alert must always be acted on and every silence counts against the unit's sepsis bundle compliance. Last month a nurse silenced it and the patient was transferred to ICU six hours later; she was written up." } },
  { tool: "container", name: "container-ai-committee",
    fill: { "#container-input": "Our AI oversight committee is 9 people: CMIO (chair), two physicians, a nurse informaticist, IT security, compliance, legal, quality, and a vendor-management lead. We meet monthly and review new AI requests from departments. We write recommendations to the CMO, who decides. We don't have our own budget. We don't know everything departments are using; last quarter we found out radiology had been piloting a tool for months. Most months we approve everything on the agenda because there's no time to dig in." } },
  { tool: "charter", name: "charter-community-hospital",
    fill: { "#charter-for-input": "A new clinical AI governance committee at a 180-bed community hospital that is rolling out a sepsis alert, an ambient scribe, and an imaging triage tool this year.",
            "#charter-stakes-input": "Whether to turn off a deployed tool when clinicians report it is wrong, before we have data.",
            "#charter-stakeholders-input": "Frontline nurses and physicians, patients, quality, compliance, IT" },
    select: { "#charter-failure-select": "rubber stamp" } },
];
const RUNS = ONLY ? RUNS_ALL.filter(r => r.tool === ONLY) : RUNS_ALL;
const BTN = { unpack: "#run-btn", container: "#container-btn", charter: "#charter-btn" };
const OUT = { unpack: "#output-content", container: "#container-output-content", charter: "#charter-output-content" };

(async () => {
  await new Promise(r => server.listen(3311, r));
  const browser = await chromium.launch(chrome ? { executablePath: chrome } : {});
  const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
  const errors = []; page.on("pageerror", e => errors.push(e.message));
  await page.goto("http://localhost:3311/transition/");
  const results = {};
  for (const run of RUNS) {
    for (const [sel, v] of Object.entries(run.fill)) await page.fill(sel, v);
    for (const [sel, v] of Object.entries(run.select || {})) await page.selectOption(sel, v);
    const n = log.length;
    await page.click(BTN[run.tool]);
    await page.waitForFunction(sel => { const el = document.querySelector(sel); return el && el.textContent.trim().length > 40; }, OUT[run.tool], { timeout: 180000 });
    await page.waitForTimeout(500);
    await page.locator(OUT[run.tool]).screenshot({ path: path.join(out, `${run.name}.png`) });
    const shown = await page.textContent(OUT[run.tool]);
    results[run.name] = { call: log[n], shown };
    console.log(run.name, JSON.stringify({ ms: log[n] && log[n].ms, status: log[n] && log[n].status, stop: log[n] && log[n].stop, usage: log[n] && log[n].usage }));
  }
  results.errors = errors;
  fs.writeFileSync(path.join(out, "real-results.json"), JSON.stringify(results, null, 2));
  await browser.close();
  server.close();
})().catch(e => { console.error(e); process.exit(1); });
