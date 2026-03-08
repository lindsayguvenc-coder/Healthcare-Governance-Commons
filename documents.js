export default async function handler(req, res) {
  const password = req.headers["x-intake-password"];
  if (!password || password !== process.env.INTAKE_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return res.status(200).json({ documents: [], debug: "bare handler works" });
}
