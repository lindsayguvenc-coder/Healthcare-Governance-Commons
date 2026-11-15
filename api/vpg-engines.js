// api/vpg-engines.js — route for calling one VPG engine directly.
// POST body: { engine: 'westgard' | 'bias' | 'nodes', answers, logicFlags, gapFlags }
// The engines live in api/_vpg-engines-core.js; generate-protocol.js calls them
// in-process, not through this route.
const { runEngine } = require("./_vpg-engines-core.js");

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { engine } = req.body || {};
  if (!engine) return res.status(400).json({ error: "Missing engine param. Use: westgard | bias | nodes" });
  if (!["westgard", "bias", "nodes"].includes(engine)) return res.status(400).json({ error: `Unknown engine: ${engine}` });
  try {
    return res.status(200).json(runEngine(engine, req.body));
  } catch (err) {
    console.error("vpg-engines error:", err);
    return res.status(500).json({ error: "Engine failed", detail: err.message });
  }
}
