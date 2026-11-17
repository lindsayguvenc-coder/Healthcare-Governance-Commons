// The one way the Site QC agents (scripts/site-agents.mjs) reach the AI.
//
// Real mode: the Anthropic Messages API with SITE_QC_ANTHROPIC_KEY (a GitHub
// secret, separate from the site's own key in Vercel).
// Fake mode: SITE_QC_FAKE_AI=<file> answers every call from that file, keyed by
// the call's label, so the agents and their planted tests can be checked
// without spending anything. SITE_QC_FAKE_KEY=missing|expired|broke|limit
// plays a key problem instead.
//
// A key problem never goes quiet: keyCheck() says what's wrong in plain words,
// and every agent that needed the key reports that it didn't run.

import { readFileSync } from "node:fs";

const API = "https://api.anthropic.com/v1";
export const MODEL = process.env.SITE_QC_AGENT_MODEL || "claude-sonnet-5-5";
const FAKE_FILE = process.env.SITE_QC_FAKE_AI || "";
const FAKE = FAKE_FILE ? JSON.parse(readFileSync(FAKE_FILE, "utf8")) : null;
export const fakeMode = () => Boolean(FAKE);

// What a key problem looks like, from what the API sends back. Kept in one place
// so the planted key test checks the same code the real run uses.
export function classifyKeyProblem(status, body) {
  const msg = String(body?.error?.message || body?.message || "").toLowerCase();
  const type = String(body?.error?.type || "").toLowerCase();
  if (status === "missing") return { problem: "missing", say: "No API key is set. Add SITE_QC_ANTHROPIC_KEY under Settings → Secrets and variables → Actions → Secrets." };
  if (status === 401 || type === "authentication_error") return { problem: "expired", say: "The API key was refused: it's expired, deleted, or mistyped. Make a new one and replace the SITE_QC_ANTHROPIC_KEY secret." };
  if (status === 403 || type === "permission_error") return { problem: "no-permission", say: "The API key works but isn't allowed to do this (workspace or model permission). Check the key's workspace in the Console." };
  if (/credit balance|billing|insufficient|purchase credits/.test(msg)) return { problem: "broke", say: "The API account is out of credit, so nothing ran. Add credit in the Console, or raise the key's spending cap." };
  if (status === 429 && /spend|limit for this|usage limit|monthly/.test(msg)) return { problem: "spend-cap", say: "The key hit its spending cap, so the run stopped. Raise the cap or wait for it to reset." };
  if (status === 429 || type === "rate_limit_error") return { problem: "rate-limit", say: "The key is being rate-limited. The run stopped; it'll try again next time." };
  if (status === 529 || type === "overloaded_error") return { problem: "overloaded", say: "The API was overloaded. The run stopped; it'll try again next time." };
  return null;
}

class KeyProblem extends Error {
  constructor(k) { super(k.say); this.key = k; }
}
export { KeyProblem };

const FAKE_KEY = {
  missing: ["missing", null],
  expired: [401, { error: { type: "authentication_error", message: "invalid x-api-key" } }],
  broke: [400, { error: { type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API." } }],
  limit: [429, { error: { type: "rate_limit_error", message: "This request would exceed your organization's monthly usage limit for this key." } }],
};

const key = () => process.env.SITE_QC_ANTHROPIC_KEY || "";

// Free call (lists models) that proves the key is there and accepted. A key
// that's accepted but out of credit only shows on the first real call, which
// callClaude() reports the same way.
export async function keyCheck() {
  const fk = process.env.SITE_QC_FAKE_KEY;
  if (fk && FAKE_KEY[fk]) {
    if (fk === "broke" || fk === "limit") return { ok: true, say: "Key accepted (fake)." }; // these show on the first call
    return { ok: false, ...classifyKeyProblem(...FAKE_KEY[fk]) };
  }
  if (FAKE) return { ok: true, say: "Fake AI: no key used." };
  if (!key()) return { ok: false, ...classifyKeyProblem("missing") };
  try {
    const r = await fetch(`${API}/models?limit=1`, { headers: { "x-api-key": key(), "anthropic-version": "2023-06-01" } });
    if (r.ok) return { ok: true, say: "Key accepted." };
    const body = await r.json().catch(() => ({}));
    return { ok: false, ...(classifyKeyProblem(r.status, body) || { problem: "unknown", say: `The key check got HTTP ${r.status}: ${body?.error?.message || "no reason given"}` }) };
  } catch (e) {
    return { ok: false, problem: "unreachable", say: `Couldn't reach the API to check the key (${e.cause?.code || e.message}).` };
  }
}

// Spend and size, per agent, so the run can report them and stop at its limit.
export const usage = {};
const tally = (agent, u = {}, searches = 0) => {
  const t = usage[agent] ||= { calls: 0, input: 0, output: 0, searches: 0 };
  t.calls++; t.input += u.input_tokens || 0; t.output += u.output_tokens || 0;
  t.searches += searches || u.server_tool_use?.web_search_requests || 0;
};

// One call. `label` names the call for the log and for fake mode ("C3:scan").
// Returns { text, stop, raw }. Throws KeyProblem on any key trouble, so the
// agent reports it instead of carrying on with an empty answer.
export async function callClaude({ agent, label, system, messages, tools, max_tokens = 2000, fakeIds }) {
  const fk = process.env.SITE_QC_FAKE_KEY;
  if (fk === "broke" || fk === "limit") throw new KeyProblem(classifyKeyProblem(...FAKE_KEY[fk]));
  if (FAKE) {
    let ans = FAKE[label] ?? FAKE[label.split(":").slice(0, 2).join(":")];
    if (ans === undefined) throw new Error(`fake AI has no answer for "${label}"`);
    // {"$each": {...}, "$override": {id: {...}}}: one answer per id the caller sent (the claims audit)
    if (ans && ans.$each && fakeIds) ans = { claims: fakeIds.map(id => ({ id, ...ans.$each, ...(ans.$override?.[id] || {}) })) };
    tally(agent, { input_tokens: 0, output_tokens: 0 }, 0);
    return { text: typeof ans === "string" ? ans : JSON.stringify(ans), stop: "end_turn", raw: null };
  }
  if (!key()) throw new KeyProblem(classifyKeyProblem("missing"));
  const body = { model: MODEL, max_tokens, temperature: 0, system, messages };
  if (tools) body.tools = tools;
  let r, j;
  for (let attempt = 0; attempt < 2; attempt++) { // one retry, for an overloaded API only
    r = await fetch(`${API}/messages`, { method: "POST", headers: { "x-api-key": key(), "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify(body) });
    j = await r.json().catch(() => ({}));
    if (r.status !== 529) break;
    await new Promise(res => setTimeout(res, 15000));
  }
  if (!r.ok) {
    const k = classifyKeyProblem(r.status, j);
    if (k) throw new KeyProblem(k);
    throw new Error(`API HTTP ${r.status}: ${j?.error?.message || "no reason given"}`);
  }
  tally(agent, j.usage);
  const text = (j.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  return { text, stop: j.stop_reason, raw: j };
}

// Pull the JSON object out of a reply. Returns null when there isn't one, so
// the caller can say "couldn't read the answer" rather than treat it as empty.
export function readJson(text) {
  const t = String(text || "").replace(/```(?:json)?/g, "");
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
}
