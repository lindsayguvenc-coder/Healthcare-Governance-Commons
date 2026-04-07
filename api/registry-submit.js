// api/registry-submit.js
// Accepts new registry submissions.
// Stores as pending — Commons admin reviews before publishing.
// Email contact info stored separately from public entry.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const entry = req.body;
    if (!entry || !entry.system || !entry.useType || !entry.setting) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Sanitize — strip anything that shouldn't be stored
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
      pending: true, // Must be approved before appearing in public list
    };

    // Store contact info separately (never part of public entry)
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
      // Add to pending review queue
      await client.lPush('registry:pending', safeEntry.id);
      await client.disconnect();
    }

    return res.status(200).json({ ok: true, id: safeEntry.id });
  } catch (err) {
    console.error('registry-submit error:', err);
    return res.status(500).json({ error: 'Submission failed', detail: err.message });
  }
}
