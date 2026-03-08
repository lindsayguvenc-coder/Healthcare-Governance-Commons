import Redis from "ioredis";

const DOCS_KEY = "user_documents";

let redis;
function getRedis() {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, {
      tls: process.env.REDIS_URL?.startsWith("rediss://") ? { rejectUnauthorized: false } : undefined,
      maxRetriesPerRequest: 3,
    });
  }
  return redis;
}

export default async function handler(req, res) {
  const password = req.headers["x-intake-password"];
  if (!password || password !== process.env.INTAKE_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const client = getRedis();

  if (req.method === "GET") {
    try {
      const raw = await client.get(DOCS_KEY);
      const docs = raw ? JSON.parse(raw) : [];
      return res.status(200).json({ documents: docs });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

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
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === "DELETE") {
    try {
      const { index } = req.body;
      const raw = await client.get(DOCS_KEY);
      const existing = raw ? JSON.parse(raw) : [];
      const updated = existing.filter((_, i) => i !== index);
      await client.set(DOCS_KEY, JSON.stringify(updated));
      return res.status(200).json({ success: true, total: updated.length });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
