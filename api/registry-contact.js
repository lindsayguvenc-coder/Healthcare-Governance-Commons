// api/registry-contact.js
// Stores contact introduction requests.
// Does NOT expose the target organization's email — Commons facilitates.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
    console.error('registry-contact error:', err);
    return res.status(500).json({ error: 'Request failed', detail: err.message });
  }
}
