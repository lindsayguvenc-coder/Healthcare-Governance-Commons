// api/status.js — public switches the static pages read on load.
// REPORTS_PAUSED=1 (set in Vercel) pauses the report tools: VPG, ROI,
// Consultation, Transition. The map's Synthesize and Collaborator stay on.
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ reportsPaused: process.env.REPORTS_PAUSED === "1" });
}
