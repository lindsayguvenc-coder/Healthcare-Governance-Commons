// api/queue.js — private side of the contribution review queue.
// Requires the intake password (x-intake-password header).
//
// GET: list pending contributions, oldest first. Items without AI reviews get
//      two independent reads (see _review.js), a few per request.
// POST { id, action: "approve" | "reject", reason }: Lindsay's decision.
//      Approve publishes on the node page; reject deletes the contribution.
//
// Kept for calibration, never content: counts in suggest:stats, and a decision
// log in suggest:decisions (type, node, link domain, both AI verdicts, the
// consensus, Lindsay's call, whether she overrode the consensus, reason).
// This is the record a future multi-level escalation pathway gets built from.
const { getRedis, isPrivate, count, domainOf, STATS_KEY, PENDING_KEY, approvedKey } = require("./_queue.js");
const { reviewItem, REASONS } = require("./_review.js");

const LOG_KEY = "suggest:decisions";
const LOG_MAX = 5000;
const REVIEWS_PER_REQUEST = 3;

export default async function handler(req, res) {
  if (!isPrivate(req)) return res.status(401).json({ error: "Unauthorized" });
  const client = getRedis();
  if (!client) return res.status(503).json({ error: "Storage not configured" });

  if (req.method === "GET") {
    const all = await client.hgetall(PENDING_KEY);
    const items = Object.values(all || {}).map(v => JSON.parse(v))
      .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));

    // Fill in missing or failed reviews, a few at a time to stay inside time limits.
    const needs = items.filter(it => !it.review || it.review.consensus === null).slice(0, REVIEWS_PER_REQUEST);
    await Promise.all(needs.map(async it => {
      it.review = await reviewItem(it);
      await client.hset(PENDING_KEY, it.id, JSON.stringify(it));
    }));
    const unreviewed = items.filter(it => !it.review || it.review.consensus === null).length;

    const stats = await client.hgetall(STATS_KEY);
    return res.status(200).json({ items, unreviewed, stats: stats || {} });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { id, action, reason } = req.body || {};
  if (action !== "approve" && action !== "reject") return res.status(400).json({ error: "Use approve or reject" });
  const raw = id ? await client.hget(PENDING_KEY, String(id)) : null;
  if (!raw) return res.status(404).json({ error: "Not in the queue (already decided?)" });

  const pending = JSON.parse(raw);
  const hours = Math.max(0, Math.round((Date.now() - Date.parse(pending.submittedAt)) / 3600000));
  const domain = pending.url ? domainOf(pending.url) : null;
  const rv = pending.review || {};
  const consensus = rv.consensus || "none";
  const overrode = (consensus === "approve" || consensus === "reject") && consensus !== action;
  const why = action === "reject"
    ? (REASONS.includes(reason) ? reason : (consensus === "reject" ? (rv.fit?.reason || "other") : "other"))
    : null;

  // Calibration record: no text, no link, no name.
  const record = {
    at: new Date().toISOString(), kind: pending.kind, nodeId: pending.nodeId, domain,
    fit: rv.fit?.verdict || null, skeptic: rv.skeptic?.verdict || null,
    consensus, final: action, overrode, reason: why, hours, model: rv.model || null,
  };
  await client.lpush(LOG_KEY, JSON.stringify(record));
  await client.ltrim(LOG_KEY, 0, LOG_MAX - 1);

  await count(client, "reviewed", `consensus:${consensus}`, `final:${consensus}:${action}`);
  if (overrode) await count(client, `overrode:${pending.kind}`);
  if (consensus === "split") await count(client, `split:sided-with:${rv.fit?.verdict === action ? "fit" : "skeptic"}`);
  await client.hincrby(STATS_KEY, "review-hours:total", hours);

  if (action === "approve") {
    const { review, ...publicItem } = pending; // AI reviews stay private
    const item = { ...publicItem, approvedAt: new Date().toISOString() };
    await count(client, `approved:${item.kind}`, ...(domain ? [`approved:domain:${domain}`] : []));
    await client.lpush(approvedKey(item.nodeId), JSON.stringify(item));
    await client.hdel(PENDING_KEY, String(id));
    return res.status(200).json({ ok: true, approved: item.id });
  }

  await count(client, `rejected:${pending.kind}`, `rejected:reason:${why}`, ...(domain ? [`rejected:domain:${domain}`] : []));
  await client.hdel(PENDING_KEY, String(id));
  return res.status(200).json({ ok: true, rejected: String(id) });
}
