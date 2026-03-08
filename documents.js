// Uses Redis REST API via fetch - no external dependencies needed

const DOCS_KEY = "user_documents";

// Parse redis:// URL into REST API base URL
// RedisLabs format: redis://default:PASSWORD@HOST:PORT
function getRedisConfig() {
  const url = process.env.REDIS_URL;
  const match = url.match(/redis:\/\/([^:]+):([^@]+)@([^:]+):(\d+)/);
  if (!match) throw new Error("Invalid REDIS_URL format");
  const [, user, password, host, port] = match;
  return { host, port, password };
}

async function redisGet(key) {
  const { host, port, password } = getRedisConfig();
  const res = await fetch(`https://${host}:${port}/get/${key}`, {
    headers: { Authorization: `Bearer ${password}` },
  });
  if (!res.ok) throw new Error(`Redis GET failed: ${res.status}`);
  const data = await res.json();
  return data.result;
}

async function redisSet(key, value) {
  const { host, port, password } = getRedisConfig();
  const res = await fetch(`https://${host}:${port}/set/${key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${password}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([value]),
  });
  if (!res.ok) throw new Error(`Redis SET failed: ${res.status}`);
  return true;
}

export default async function handler(req, res) {
  const password = req.headers["x-intake-password"];
  if (!password || password !== process.env.INTAKE_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    try {
      const raw = await redisGet(DOCS_KEY);
      const docs = raw ? JSON.parse(raw) : [];
      return res.status(200).json({ documents: docs });
    } catch (err) {
      return res.status(500).json({ error: "GET failed: " + err.message });
    }
  }

  if (req.method === "POST") {
    try {
      const newDoc = req.body;
      if (!newDoc || !newDoc.title) {
        return res.status(400).json({ error: "Invalid document" });
      }
      const raw = await redisGet(DOCS_KEY);
      const existing = raw ? JSON.parse(raw) : [];
      const updated = [...existing, { ...newDoc, addedAt: new Date().toISOString() }];
      await redisSet(DOCS_KEY, JSON.stringify(updated));
      return res.status(200).json({ success: true, total: updated.length });
    } catch (err) {
      return res.status(500).json({ error: "POST failed: " + err.message });
    }
  }

  if (req.method === "DELETE") {
    try {
      const { index } = req.body;
      const raw = await redisGet(DOCS_KEY);
      const existing = raw ? JSON.parse(raw) : [];
      const updated = existing.filter((_, i) => i !== index);
      await redisSet(DOCS_KEY, JSON.stringify(updated));
      return res.status(200).json({ success: true, total: updated.length });
    } catch (err) {
      return res.status(500).json({ error: "DELETE failed: " + err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
