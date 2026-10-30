// Per-tool report pause. Underscore prefix: Vercel does not expose this as a route.
// CommonJS on purpose: api/package.json declares "type": "commonjs".
//
// A report tool is paused if it is listed here OR named in the REPORTS_PAUSED env var.
// Each tool comes off this list in the pull request that finishes its content review
// (decided Oct 29, 2026), so merging that PR is what turns its reports back on.
// REPORTS_PAUSED in Vercel stays as the emergency switch: "1" or "all" pauses every
// report tool; a comma list ("roi,transition") pauses just those; "0" or unset adds none.
const TOOLS = ["vpg", "roi", "consultation", "transition"];
const PAUSED_IN_CODE = ["vpg", "roi", "consultation", "transition"];

function pausedTools() {
  const env = String(process.env.REPORTS_PAUSED || "").trim().toLowerCase();
  const fromEnv = env === "1" || env === "all" ? TOOLS
    : env === "" || env === "0" ? []
    : env.split(",").map((s) => s.trim()).filter((s) => TOOLS.includes(s));
  return TOOLS.filter((t) => PAUSED_IN_CODE.includes(t) || fromEnv.includes(t));
}

// Unknown or missing tool names count as paused, so a page that forgets to say which
// tool it is fails closed.
function isPaused(tool) {
  return !TOOLS.includes(tool) || pausedTools().includes(tool);
}

module.exports = { TOOLS, pausedTools, isPaused };
