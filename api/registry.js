// api/registry.js
// Consolidated registry route — list, submit, and contact in one function.
// Dispatches by `action` param in POST body, or GET for listing.
//
// GET  → list published entries
// POST { action: 'submit', ...entry } → submit new registration
// POST { action: 'contact', ...request } → submit introduction request

export default async function handler(req, res) {

  // ── GET: list published entries ──────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
      if (!redisUrl) return res.status(200).json({ entries: [] });

      const { createClient } = await import('redis');
      const client = createClient({ url: redisUrl });
      await client.connect();

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

      entries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      return res.status(200).json({ entries });
    } catch (err) {
      console.error('registry list error:', err);
      return res.status(200).json({ entries: [] }); // fail gracefully — seeds still show
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action } = req.body;

  // ── POST: submit registration ─────────────────────────────────────────────
  if (action === 'submit') {
    try {
      const entry = req.body;
      if (!entry.system || !entry.useType || !entry.setting) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const safeEntry = {
        id: entry.id || ('sub-' + Date.now()),
        org: entry.org || null,
        anon: !!entry.anon,
        anonDesc: entry.anonDesc || null,
        system: String(entry.system).slice(0, 200),
        useType: String(entry.useType).slice(0, 200),
        setting: String(entry.setting).slice(0, 200),
        contact: ['direct', 'facilitated', 'none'].includes(entry.contact) ? entry.contact : 'none',
        hasMethodology: !!entry.hasMethodology,
        methodology: entry.hasMethodology ? {
          challengeSet: String(entry.methodology?.challengeSet || '').slice(0, 500),
          blindRun: String(entry.methodology?.blindRun || '').slice(0, 500),
          comparison: String(entry.methodology?.comparison || '').slice(0, 500),
          lessons: String(entry.methodology?.lessons || '').slice(0, 500),
        } : null,
        date: new Date().toISOString().slice(0, 7),
        submittedAt: new Date().toISOString(),
        pending: true,
      };

      const contactRecord = entry.contact !== 'none' && entry.email ? {
        entryId: safeEntry.id,
        email: String(entry.email).slice(0, 200),
        contact: safeEntry.contact,
      } : null;

      const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
      if (redisUrl) {
        const { createClient } = await import('redis');
        const client = createClient({ url: redisUrl });
        await client.connect();
        await client.set(`registry:entry:${safeEntry.id}`, JSON.stringify(safeEntry));
        if (contactRecord) {
          await client.set(`registry:contact:${safeEntry.id}`, JSON.stringify(contactRecord));
        }
        await client.lPush('registry:pending', safeEntry.id);
        await client.disconnect();
      }

      return res.status(200).json({ ok: true, id: safeEntry.id });
    } catch (err) {
      console.error('registry submit error:', err);
      return res.status(500).json({ error: 'Submission failed', detail: err.message });
    }
  }

  // ── POST: contact request ─────────────────────────────────────────────────
  if (action === 'contact') {
    try {
      const { targetId, name, org, email, message } = req.body;
      if (!targetId || !name || !email) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const request = {
        id: 'req-' + Date.now(),
        targetId: String(targetId).slice(0, 100),
        requesterName: String(name).slice(0, 200),
        requesterOrg: String(org || '').slice(0, 200),
        requesterEmail: String(email).slice(0, 200),
        message: String(message || '').slice(0, 1000),
        submittedAt: new Date().toISOString(),
        status: 'pending',
      };

      const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
      if (redisUrl) {
        const { createClient } = await import('redis');
        const client = createClient({ url: redisUrl });
        await client.connect();
        await client.set(`registry:request:${request.id}`, JSON.stringify(request));
        await client.lPush('registry:requests-pending', request.id);
        await client.disconnect();
      }

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('registry contact error:', err);
      return res.status(500).json({ error: 'Request failed', detail: err.message });
    }
  }

  return res.status(400).json({ error: 'Missing or unknown action. Use: submit | contact' });
}
