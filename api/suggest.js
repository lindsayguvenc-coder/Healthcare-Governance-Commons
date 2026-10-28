// api/suggest.js — public side of the contribution review queue.
// POST: submit a source, question, note, or tool for a node. Goes to review.
// GET ?node=<id>: list contributions Lindsay has approved for that node.
const { getRedis, sameSite, underLimit, buildItem, count, PENDING_KEY, approvedKey, NODE_IDS } = require("./_queue.js");

export default async function handler(req, res) {
  const client = getRedis();

  if (req.method === "GET") {
    const nodeId = String(req.query?.node || "");
    if (!NODE_IDS.has(nodeId)) return res.status(400).json({ error: "Unknown node." });
    if (!client) return res.status(200).json({ items: [] });
    try {
      const raw = await client.lrange(approvedKey(nodeId), 0, 199);
      return res.status(200).json({ items: raw.map(r => JSON.parse(r)) });
    } catch {
      return res.status(200).json({ items: [] });
    }
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (process.env.SUGGESTIONS_OPEN === "false") return res.status(503).json({ error: "Contributions are paused right now." });
  if (!sameSite(req)) return res.status(403).json({ error: "Contributions only work from the Governance Commons site." });
  if (!client) return res.status(503).json({ error: "The review queue isn't connected. Nothing was saved." });

  const { item, error, blocked } = buildItem(req.body || {});
  if (error === "spam") { await count(client, "bot:honeypot"); return res.status(200).json({ ok: true }); } // don't tell bots
  if (blocked) await count(client, `refused:screen:${blocked}`);
  else if (error) await count(client, "refused:invalid");
  if (error) return res.status(400).json({ error });

  if (!(await underLimit(client, req))) {
    await count(client, "refused:rate-limit");
    return res.status(429).json({ error: "Too many contributions from your connection this hour. Try again later." });
  }

  try {
    await client.hset(PENDING_KEY, item.id, JSON.stringify(item));
    await count(client, `submitted:${item.kind}`, `submitted:node:${item.nodeId}`);
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Saving failed. Nothing was saved; please try again later." });
  }
}
