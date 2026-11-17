// Checks the Site QC agents with fake AI replies only: nothing is sent to the
// AI and no key is used. Each scenario runs scripts/site-agents.mjs and checks
// what it reported. Run: node tests/site-qc/agents/run-fake.mjs
// (S2 drives the real pages, so it needs playwright in tests/replay and Chrome:
// CHROME=/usr/bin/google-chrome.)
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../../..", import.meta.url).pathname;
const here = "tests/site-qc/agents";
function run(env, only = "C3,C4,S2") {
  rmSync(join(root, "qc-out/site-agents.json"), { force: true });
  try { execFileSync("node", ["scripts/site-agents.mjs", "--only", only], { cwd: root, env: { ...process.env, SITE_QC_TODAY: "2026-11-23", SITE_QC_SKIP: "", ...env }, stdio: "pipe" }); } catch {}
  return JSON.parse(readFileSync(join(root, "qc-out/site-agents.json"), "utf8"));
}
let bad = 0;
const ok = (name, cond, extra = "") => { console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : "  " + extra}`); if (!cond) bad++; };
const has = (s, id, kind, level, re) => s.results.some(r => r.id === id && r.kind === kind && r.level === level && re.test(r.check + " " + r.detail));

const good = run({ SITE_QC_FAKE_AI: `${here}/fake-good.json` });
ok("Good replies: every planted test caught", good.failedControls === 0 && good.results.filter(r => r.kind === "control").length === 17, JSON.stringify(good.results.filter(r => r.kind === "control" && !r.ok)));
ok("Good replies: no failures", good.failedSite === 0, JSON.stringify(good.results.filter(r => r.level === "fail")));
ok("Good replies: C3 report names the finding", readFileSync(join(root, "qc-out/regulatory-scan.md"), "utf8").includes("HTI-6"));
ok("Good replies: C4 flags the found source for a Needs-source claim", has(good, "C4", "check", "warn", /Possible source/));
ok("Good replies: S2 graded all four tool answers", has(good, "S2", "check", "ok", /4 tool answer\(s\) graded, 4 in their lane/));

const miss = run({ SITE_QC_FAKE_AI: `${here}/fake-misses.json` });
ok("Broken agents: C3 missing the planted rule change is a control failure", has(miss, "C3", "control", "fail", /QC-C3-0001/));
ok("Broken agents: C4 missing the misquoted citation is a control failure", has(miss, "C4", "control", "fail", /QC-C4-0001/));
ok("Broken agents: S2 grader passing the planted dose is a control failure", has(miss, "S2", "control", "fail", /QC-S2-0001.*grader/));
ok("Broken agents: a finding with no source fails", has(miss, "C3", "check", "fail", /no source/));
ok("Broken agents: a source outside the allowed list warns", has(miss, "C3", "check", "warn", /outside the allowed list/));
ok("Broken agents: a claim its source doesn't support fails", has(miss, "C4", "check", "fail", /doesn't say this/));
ok("Broken agents: a dose the grader passed is caught by the code backstop", has(miss, "S2", "check", "fail", /backstop found a dose/));
ok("Broken agents: the report says not to trust it", readFileSync(join(root, "qc-out/regulatory-scan.md"), "utf8").includes("don't trust this report"));

for (const [k, re] of [["missing", /No API key is set/], ["expired", /expired, deleted, or mistyped/], ["broke", /out of credit/], ["limit", /spending cap/]]) {
  const s = run({ SITE_QC_FAKE_AI: `${here}/fake-good.json`, SITE_QC_FAKE_KEY: k });
  ok(`Key ${k}: every agent says so, none goes quiet`, ["C3", "C4", "S2"].every(id => has(s, id, "check", "fail", re)) && s.failedSite === 3);
}
const real = run({ SITE_QC_FAKE_AI: "", SITE_QC_ANTHROPIC_KEY: "" }, "C3");
ok("Real mode with no key set: says the key is missing", has(real, "C3", "check", "fail", /No API key is set/) && real.key === "missing");

const skip = run({ SITE_QC_FAKE_AI: `${here}/fake-good.json`, SITE_QC_SKIP: "C4,S2" });
ok("SITE_QC_SKIP=C4,S2: only C3 runs, and the run lists what it skipped", skip.skipped.join() === "C4,S2" && !skip.results.some(r => r.id !== "C3"));

console.log(bad ? `\n${bad} failed` : "\nAll passed");
process.exit(bad ? 1 : 0);
