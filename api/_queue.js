// api/_queue.js
// Shared pieces for the contribution review queue (suggest.js, queue.js).
// Underscore prefix: Vercel does not expose this file as a route.
//
// What the queue stores, by design:
//   - the contribution itself (a link, a question, a note, a tool)
//   - for notes only: an optional name and role the contributor chose to publish
//   - a timestamp and an id
// It never stores email, IP address, or any other contact detail. The per-IP
// rate limit uses a counter that expires after about an hour.

const Redis = require("ioredis");
const NODES = require("../src/data/nodes.json");

const NODE_IDS = new Set(NODES.map(n => n.id));
const KINDS = new Set(["source", "question", "note", "tool"]);
const PUBLIC_PER_HOUR = 10;
const PENDING_KEY = "suggest:pending";          // hash: id -> JSON
const approvedKey = nodeId => `suggest:approved:${nodeId}`; // list of JSON

let redis;
function getRedis() {
  const url = process.env.REDIS_URL || process.env.KV_URL;
  if (!url) return null;
  if (!redis) redis = new Redis(url, { maxRetriesPerRequest: 2, connectTimeout: 8000 });
  return redis;
}

function sameSite(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const source = req.headers.origin || req.headers.referer;
  if (!host || !source) return false;
  try { return new URL(source).host === host; } catch { return false; }
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  return fwd ? String(fwd).split(",")[0].trim() : (req.headers["x-real-ip"] || "unknown");
}

async function underLimit(client, req) {
  try {
    const hour = Math.floor(Date.now() / 3600000);
    const key = `ratelimit:suggest:${clientIp(req)}:${hour}`;
    const n = await client.incr(key);
    if (n === 1) await client.expire(key, 3700);
    return n <= PUBLIC_PER_HOUR;
  } catch { return true; }
}

function isPrivate(req) {
  const pw = req.headers["x-intake-password"];
  return Boolean(pw && process.env.INTAKE_PASSWORD && pw === process.env.INTAKE_PASSWORD);
}

// Patient information and contact details don't belong in a public contribution.
const BLOCK_PATTERNS = [
  { re: /\b\d{3}-\d{2}-\d{4}\b/, why: "a Social Security number" },
  { re: /\b(MRN|medical record|patient id|pt id)[:\s#]*\d{4,}/i, why: "a medical record number" },
  { re: /\b(DOB|date of birth|born on)[:\s]*\d/i, why: "a date of birth" },
  { re: /[\w.+-]+@[\w-]+\.[\w.]+/, why: "an email address" },
  { re: /\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/, why: "a phone number" },
];
function screen(text) {
  for (const p of BLOCK_PATTERNS) if (p.re.test(text)) return p.why;
  return null;
}

function clean(v, max) {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function validUrl(u) {
  try { const x = new URL(u); return x.protocol === "https:" || x.protocol === "http:"; } catch { return false; }
}

// Returns { item } or { error } for a public submission body.
function buildItem(body) {
  if (body.website) return { error: "spam" };            // honeypot field, invisible to people
  const kind = clean(body.kind, 20);
  const nodeId = clean(body.nodeId, 40);
  if (!KINDS.has(kind)) return { error: "Unknown contribution type." };
  if (!NODE_IDS.has(nodeId)) return { error: "Unknown node." };

  const item = { id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, kind, nodeId, submittedAt: new Date().toISOString() };

  if (kind === "source" || kind === "tool") {
    const url = clean(body.url, 500);
    if (!validUrl(url)) return { error: "Add a full link starting with https://" };
    item.url = url;
    item.text = clean(body.text, 300);
    if (!item.text) return { error: "Add one line on why it belongs here." };
  } else if (kind === "question") {
    item.text = clean(body.text, 500);
    if (item.text.length < 10) return { error: "Write out the question." };
  } else if (kind === "note") {
    item.text = clean(body.text, 1500);
    if (item.text.length < 20) return { error: "The note is too short to review." };
    if (body.consent !== true) return { error: "Tick the box agreeing that the note is published." };
    item.name = clean(body.name, 80) || null;
    item.role = clean(body.role, 120) || null;
  }

  const flagged = screen([item.text, item.url, item.name, item.role].filter(Boolean).join(" "));
  if (flagged) return { blocked: flagged, error: `This seems to include ${flagged}. Contributions are public, so remove personal or patient details and try again.` };
  return { item };
}

// Counts only, never content. These exist so a future decision about
// auto-approval rests on real numbers: what arrives, what gets accepted, how
// long review takes, and which source domains are reliably good.
const STATS_KEY = "suggest:stats";
async function count(client, ...fields) {
  try { for (const f of fields) await client.hincrby(STATS_KEY, f, 1); } catch {}
}
function domainOf(u) {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return null; }
}

module.exports = { count, domainOf, STATS_KEY, getRedis, sameSite, underLimit, isPrivate, buildItem, PENDING_KEY, approvedKey, NODE_IDS };
