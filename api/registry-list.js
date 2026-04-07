// api/registry-list.js
// Returns published registry entries from Redis.
// Seed entries live in the frontend — this only returns real submissions.

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
    if (!redisUrl) {
      return res.status(200).json({ entries: [] });
    }

    const { createClient } = await import('redis');
    const client = createClient({ url: redisUrl });
    await client.connect();

    // Published entries only (pending entries wait for Commons review)
    const keys = await client.keys('registry:entry:*');
    const entries = [];
    for (const key of keys) {
      const raw = await client.get(key);
      if (raw) {
        const entry = JSON.parse(raw);
        if (!entry.pending) entries.push(entry);
      }
    }
    await client.disconnect();

    // Sort by date descending
    entries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return res.status(200).json({ entries });
  } catch (err) {
    console.error('registry-list error:', err);
    return res.status(200).json({ entries: [] }); // Fail gracefully — seeds still show
  }
}
