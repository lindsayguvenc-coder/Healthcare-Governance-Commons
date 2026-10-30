// api/_relay.js
// Shared guard for every route that calls the Anthropic API.
// Underscore prefix: Vercel does not expose this file as a route.
//
// Before this, each AI route forwarded whatever the browser sent straight to
// Anthropic, so anyone could run any prompt on any model with the Commons key.
// Now the server decides the model and the limits; the browser only supplies
// the prompt (system + messages).
//
// Limits:
//   - Model is fixed server-side. Change it in Vercel with the ANTHROPIC_MODEL
//     environment variable, no code change needed.
//   - max_tokens capped at MAX_OUTPUT_TOKENS.
//   - Public requests: small bodies, no file uploads, rate-limited per IP.
//   - Requests carrying the intake password (Lindsay's private intake) may
//     send documents and larger bodies, and skip the rate limit.
//   - Requests must come from a page on this same site (Origin/Referer check).
//     This stops other websites from using the endpoint from a browser; it does
//     not stop a determined script. The rate limit and caps bound that case.
const { isPaused } = require("./_pause.js");
const { strongHit, strings, REFUSAL } = require("./_phi.js");

const Redis = require("ioredis");

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const MAX_OUTPUT_TOKENS = 2500;
const PUBLIC_MAX_BODY_CHARS = 60000;
const PRIVATE_MAX_BODY_CHARS = 4400000;
const PUBLIC_REQUESTS_PER_HOUR = 30;

let redis;
function getRedis() {
  if (!process.env.REDIS_URL && !process.env.KV_URL) return null;
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || process.env.KV_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
    });
  }
  return redis;
}

function sameSite(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const source = req.headers.origin || req.headers.referer;
  if (!host || !source) return false;
  try {
    return new URL(source).host === host;
  } catch {
    return false;
  }
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return String(fwd).split(",")[0].trim();
  return req.headers["x-real-ip"] || "unknown";
}

// Returns true if the request is allowed. Fails open if Redis is unavailable,
// so a storage outage doesn't take the tools down; the other caps still apply.
async function underRateLimit(req) {
  const client = getRedis();
  if (!client) return true;
  try {
    const hour = Math.floor(Date.now() / 3600000);
    const key = `ratelimit:ai:${clientIp(req)}:${hour}`;
    const count = await client.incr(key);
    if (count === 1) await client.expire(key, 3700);
    return count <= PUBLIC_REQUESTS_PER_HOUR;
  } catch {
    return true;
  }
}

function hasDocumentBlocks(messages) {
  return messages.some(
    (m) => Array.isArray(m.content) && m.content.some((c) => c && c.type !== "text")
  );
}

async function relay(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = (process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY);
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured" });
  }

  if (!sameSite(req)) {
    return res.status(403).json({ error: "This tool only works from the Governance Commons site." });
  }

  const pw = req.headers["x-intake-password"];
  const isPrivate = Boolean(pw && process.env.INTAKE_PASSWORD && pw === process.env.INTAKE_PASSWORD);

  const body = req.body || {};
  if (body.purpose === "report" && isPaused(body.tool)) {
    return res.status(503).json({ error: "Report generation is paused while this tool is reviewed." });
  }
  const messages = Array.isArray(body.messages) ? body.messages : null;
  if (!messages || messages.length === 0) {
    return res.status(400).json({ error: "Missing messages" });
  }
  // Screen what the user typed (user turns only; the page's own system prompt is not user input).
  const userText = strings(messages.filter((m) => m && m.role === "user").map((m) => m.content)).join("\n");
  const phi = strongHit(userText);
  if (phi) return res.status(400).json({ error: REFUSAL(phi), phi: true });

  const forwarded = {
    model: MODEL,
    max_tokens: Math.min(Number(body.max_tokens) || 1000, MAX_OUTPUT_TOKENS),
    messages,
  };
  if (typeof body.system === "string") forwarded.system = body.system;

  const size = JSON.stringify(forwarded).length;
  const limit = isPrivate ? PRIVATE_MAX_BODY_CHARS : PUBLIC_MAX_BODY_CHARS;
  if (size > limit) {
    return res.status(413).json({ error: "That input is too long for this tool. Try a shorter excerpt." });
  }

  if (!isPrivate) {
    if (hasDocumentBlocks(messages)) {
      return res.status(403).json({ error: "File uploads to AI tools are paused on the public site." });
    }
    if (!(await underRateLimit(req))) {
      return res.status(429).json({ error: "Too many requests from your connection this hour. Try again later." });
    }
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(forwarded),
    });
    const data = await response.json();
    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { relay };
