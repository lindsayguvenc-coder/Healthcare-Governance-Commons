import { kv } from "@vercel/kv";

const DOCS_KEY = "user_documents";

export default async function handler(req, res) {
  // Password check for all operations
  const password = req.headers["x-intake-password"];
  if (!password || password !== process.env.INTAKE_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // GET — load all user-added documents
  if (req.method === "GET") {
    try {
      const docs = await kv.get(DOCS_KEY);
      return res.status(200).json({ documents: docs || [] });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // POST — save a new document
  if (req.method === "POST") {
    try {
      const newDoc = req.body;
      if (!newDoc || !newDoc.title) {
        return res.status(400).json({ error: "Invalid document" });
      }

      // Load existing, append new, save back
      const existing = await kv.get(DOCS_KEY) || [];
      const updated = [...existing, { ...newDoc, addedAt: new Date().toISOString() }];
      await kv.set(DOCS_KEY, updated);

      return res.status(200).json({ success: true, total: updated.length });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // DELETE — remove a document by index
  if (req.method === "DELETE") {
    try {
      const { index } = req.body;
      const existing = await kv.get(DOCS_KEY) || [];
      const updated = existing.filter((_, i) => i !== index);
      await kv.set(DOCS_KEY, updated);
      return res.status(200).json({ success: true, total: updated.length });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
