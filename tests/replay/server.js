// Local test server: serves the built site and runs the real /api/suggest and
// /api/queue handlers, with Redis replaced by an in-memory mock and the
// Anthropic API replaced by scripted reviewer answers.
// Usage: node server.js <repo> <port>
const http = require("http");
const fs = require("fs");
const path = require("path");
const Module = require("module");

const repo = process.argv[2];
const port = Number(process.argv[3] || 4300);
const here = __dirname;

// ioredis -> ioredis-mock, one shared instance across requires

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) {
  if (req === "ioredis") return path.join(here, "node_modules/ioredis-mock/lib/index.js");
  return origResolve.call(this, req, ...rest);
};
// handlers use `export default`; load them as CommonJS
const origJs = Module._extensions[".js"];
Module._extensions[".js"] = function (mod, filename) {
  if (filename.startsWith(path.join(repo, "api"))) {
    const src = fs.readFileSync(filename, "utf8").replace(/export default async function handler/, "module.exports = async function handler");
    return mod._compile(src, filename);
  }
  return origJs(mod, filename);
};

process.env.REDIS_URL = "redis://mock";
process.env.INTAKE_PASSWORD = "test";
process.env.VITE_ANTHROPIC_API_KEY = "mock";

// Scripted reviewers
const realFetch = global.fetch;
global.fetch = async (url, opts) => {
  if (String(url).includes("api.anthropic.com")) {
    const body = JSON.parse(opts.body);
    const skeptic = body.system.includes("second reviewer");
    const text = body.messages[0].content;
    let v;
    if (text.includes("fda.gov")) v = { verdict: "approve", reason: null, rationale: skeptic ? "Primary FDA guidance on authorized model changes; directly relevant to stop and rollback. No problems found." : "Final FDA guidance that covers pre-authorized changes and rollback, which is central to stop mechanisms." };
    else if (text.includes("example.com")) v = { verdict: "reject", reason: "promotional", rationale: skeptic ? "Sales copy with a discount offer; this is vendor marketing, not a governance tool." : "Reads as an advertisement, and the domain gives no sign of an independent tool." };
    else if (text.includes("charge nurse")) v = skeptic
      ? { verdict: "reject", reason: "low-quality", rationale: "An 80% override figure from a self-described role, with no source, would read as established fact on a public page." }
      : { verdict: "approve", reason: null, rationale: "A concrete practice observation about ownership after go-live, exactly what this node's notes are for." };
    else v = { verdict: "approve", reason: null, rationale: "Relevant to the node." };
    await new Promise(r => setTimeout(r, 900));
    return { ok: true, json: async () => ({ content: [{ type: "text", text: JSON.stringify(v) }] }) };
  }
  return realFetch(url, opts);
};

const handlers = {
  "/api/suggest": require(path.join(repo, "api/suggest.js")),
  "/api/queue": require(path.join(repo, "api/queue.js")),
};
const dist = path.join(repo, "dist");
const types = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".pdf": "application/pdf", ".json": "application/json", ".svg": "image/svg+xml" };

http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host}`);
  const h = handlers[u.pathname];
  if (h) {
    let raw = "";
    for await (const c of req) raw += c;
    req.query = Object.fromEntries(u.searchParams);
    req.body = raw ? JSON.parse(raw) : {};
    res.status = code => { res.statusCode = code; return res; };
    res.json = obj => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(obj)); };
    try { await h(req, res); } catch (e) { res.statusCode = 500; res.end(String(e.stack)); }
    return;
  }
  if (u.pathname.startsWith("/api/")) { res.statusCode = 404; return res.end("{}"); }
  let file = path.join(dist, decodeURIComponent(u.pathname));
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) file = path.join(dist, "index.html"); // SPA fallback (/nodes/:id)
  res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log("ready", port));
