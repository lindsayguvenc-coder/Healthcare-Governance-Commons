// api/status.js — public switches the static pages read on load.
// Which report tools are paused lives in api/_pause.js (per tool, plus the
// REPORTS_PAUSED emergency switch in Vercel). The map's Synthesize and
// Collaborator are not report tools and stay on.
const { pausedTools, TOOLS } = require("./_pause.js");

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const paused = pausedTools();
  return res.status(200).json({ pausedTools: paused, reportsPaused: paused.length === TOOLS.length });
}
