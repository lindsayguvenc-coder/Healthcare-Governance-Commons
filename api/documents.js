// Uses Redis via ioredis - CommonJS
const Redis = require("ioredis");

const DOCS_KEY = "user_documents";
const PUBLIC_DOCS_KEY = "public_documents";

let redis;
function getRedis() {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      connectTimeout: 10000,
    });
  }
  return redis;
}

module.exports = async function handler(req, res) {
  const client = getRedis();

  // Public GET — no password required, returns promoted docs only
  if (req.method === "GET" && req.query?.scope === "public") {
    try {
      const raw = await client.get(PUBLIC_DOCS_KEY);
      const docs = raw ? JSON.parse(raw) : [];
      return res.status(200).json({ documents: docs });
    } catch (err) {
      return res.status(500).json({ error: "Public GET failed: " + err.message });
    }
  }

  // All other operations require password
  const password = req.headers["x-intake-password"];
  if (!password || password !== process.env.INTAKE_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // GET — load all user docs
  if (req.method === "GET") {
    try {
      const raw = await client.get(DOCS_KEY);
      const publicRaw = await client.get(PUBLIC_DOCS_KEY);
      const docs = raw ? JSON.parse(raw) : [];
      const publicIds = publicRaw ? JSON.parse(publicRaw).map(d => d._privateIndex) : [];
      // Mark which docs are promoted
      const docsWithStatus = docs.map((d, i) => ({ ...d, promoted: publicIds.includes(i) }));
      return res.status(200).json({ documents: docsWithStatus });
    } catch (err) {
      return res.status(500).json({ error: "GET failed: " + err.message });
    }
  }

  // POST — save new doc
  if (req.method === "POST") {
    try {
      const newDoc = req.body;
      if (!newDoc || !newDoc.title) {
        return res.status(400).json({ error: "Invalid document" });
      }
      const raw = await client.get(DOCS_KEY);
      const existing = raw ? JSON.parse(raw) : [];
      const updated = [...existing, { ...newDoc, addedAt: new Date().toISOString() }];
      await client.set(DOCS_KEY, JSON.stringify(updated));
      return res.status(200).json({ success: true, total: updated.length });
    } catch (err) {
      return res.status(500).json({ error: "POST failed: " + err.message });
    }
  }

  // PATCH — toggle promote/unpromote
  if (req.method === "PATCH") {
    try {
      const { index } = req.body;
      const raw = await client.get(DOCS_KEY);
      const docs = raw ? JSON.parse(raw) : [];
      const doc = docs[index];
      if (!doc) return res.status(404).json({ error: "Doc not found" });

      const publicRaw = await client.get(PUBLIC_DOCS_KEY);
      let publicDocs = publicRaw ? JSON.parse(publicRaw) : [];

      const alreadyPromoted = publicDocs.some(d => d._privateIndex === index);
      if (alreadyPromoted) {
        // Unpromote
        publicDocs = publicDocs.filter(d => d._privateIndex !== index);
      } else {
        // Promote — strip sourceInput, add _privateIndex for tracking
        const { sourceInput, ...cleanDoc } = doc;
        publicDocs.push({ ...cleanDoc, _privateIndex: index, promotedAt: new Date().toISOString() });
      }

      await client.set(PUBLIC_DOCS_KEY, JSON.stringify(publicDocs));
      return res.status(200).json({ success: true, promoted: !alreadyPromoted });
    } catch (err) {
      return res.status(500).json({ error: "PATCH failed: " + err.message });
    }
  }

  // DELETE — remove doc and unpromote if needed
  if (req.method === "DELETE") {
    try {
      const { index } = req.body;
      const raw = await client.get(DOCS_KEY);
      const existing = raw ? JSON.parse(raw) : [];
      const updated = existing.filter((_, i) => i !== index);
      await client.set(DOCS_KEY, JSON.stringify(updated));

      // Also remove from public if promoted
      const publicRaw = await client.get(PUBLIC_DOCS_KEY);
      if (publicRaw) {
        const publicDocs = JSON.parse(publicRaw).filter(d => d._privateIndex !== index);
        await client.set(PUBLIC_DOCS_KEY, JSON.stringify(publicDocs));
      }

      return res.status(200).json({ success: true, total: updated.length });
    } catch (err) {
      return res.status(500).json({ error: "DELETE failed: " + err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
};
