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
function run(env, only = "C3,C4,S2,C5,C6") {
  rmSync(join(root, "qc-out/site-agents.json"), { force: true });
  try { execFileSync("node", ["scripts/site-agents.mjs", "--only", only], { cwd: root, env: { ...process.env, SITE_QC_TODAY: "2026-11-23", SITE_QC_SKIP: "", ...env }, stdio: "pipe" }); } catch {}
  return JSON.parse(readFileSync(join(root, "qc-out/site-agents.json"), "utf8"));
}
let bad = 0;
const ok = (name, cond, extra = "") => { console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : "  " + extra}`); if (!cond) bad++; };
const has = (s, id, kind, level, re) => s.results.some(r => r.id === id && r.kind === kind && r.level === level && re.test(r.check + " " + r.detail));

const good = run({ SITE_QC_FAKE_AI: `${here}/fake-good.json` });
ok("Good replies: every planted test caught", good.failedControls === 0 && good.results.filter(r => r.kind === "control").length === 34, JSON.stringify(good.results.filter(r => r.kind === "control" && !r.ok)));
ok("Good replies: no failures", good.failedSite === 0, JSON.stringify(good.results.filter(r => r.level === "fail")));
ok("Good replies: C3 report names the finding", readFileSync(join(root, "qc-out/regulatory-scan.md"), "utf8").includes("HTI-6"));
ok("Good replies: C4 flags the found source for a Needs-source claim", has(good, "C4", "check", "warn", /Possible source/));
ok("Good replies: C5 reports the planted page that moved but still loads, and the real-shaped CHAI move", has(good, "C5", "check", "ok", /2 library finding\(s\)/) && readFileSync(join(root, "qc-out/library-versions.md"), "utf8").includes("CHAI Registry"));
ok("Good replies: C5 names both files to fix for a link the library and toolbox share", readFileSync(join(root, "qc-out/library-versions.md"), "utf8").includes("library.json: chai-applied-model-card; toolbox.json: chai-card"));
ok("Good replies: C5 reads CHAI's banner as one site-wide notice and the agent ties it to the model card", has(good, "C5", "check", "ok", /Site-wide notice on chai.org \(3 pages\), tied by the agent to chai-applied-model-card/));
ok("Good replies: C5 raises no backstop warning when the agent reported the move", !has(good, "C5", "check", "warn", /says it moved|Site-wide/));
ok("Good replies: C6 report lists the proposal under its node", readFileSync(join(root, "qc-out/library-additions.md"), "utf8").includes("## contestation"));
ok("Good replies: S2 graded all four tool answers", has(good, "S2", "check", "ok", /4 tool answer\(s\) graded, 4 in their lane/));

const miss = run({ SITE_QC_FAKE_AI: `${here}/fake-misses.json` });
ok("Broken agents: C3 missing the planted rule change is a control failure", has(miss, "C3", "control", "fail", /QC-C3-0001/));
ok("Broken agents: C4 missing the misquoted citation is a control failure", has(miss, "C4", "control", "fail", /QC-C4-0001/));
ok("Broken agents: S2 grader passing the planted dose is a control failure", has(miss, "S2", "control", "fail", /QC-S2-0001.*grader/));
ok("Broken agents: a finding with no source fails", has(miss, "C3", "check", "fail", /no source/));
ok("Broken agents: a source outside the allowed list warns", has(miss, "C3", "check", "warn", /outside the allowed list/));
ok("Broken agents: a claim its source doesn't support fails", has(miss, "C4", "check", "fail", /doesn't say this/));
ok("Broken agents: a dose the grader passed is caught by the code backstop", has(miss, "S2", "check", "fail", /backstop found a dose/));
ok("Broken agents: C5 missing the planted move is a control failure", has(miss, "C5", "control", "fail", /QC-C5-0001/));
ok("Broken agents: C5 reporting the unchanged entry is a control failure", has(miss, "C5", "control", "fail", /unchanged entry/));
ok("Broken agents: C5 finding with no source fails", has(miss, "C5", "check", "fail", /no source/));
ok("Broken agents: C5 finding citing a news site, not the issuer, warns", has(miss, "C5", "check", "warn", /isn't the issuer's own site.*forbes/));
ok("Broken agents: C5 pinning the planted banner on the wrong page is a control failure", has(miss, "C5", "control", "fail", /site-wide banner/));
ok("Broken agents: C5 move note the agent didn't report is caught by the code backstop", has(miss, "C5", "check", "warn", /says it moved: toolbox:tripod.*agent didn't report/));
ok("Broken agents: C5 site-wide notice the agent didn't tie to any entry warns", has(miss, "C5", "check", "warn", /Site-wide notice on chai.org \(3 pages\) the agent didn't tie/));
ok("Broken agents: C5 report still lists the backstop's move", readFileSync(join(root, "qc-out/library-versions.md"), "utf8").includes("code backstop"));
ok("Broken agents: C6 missing the planted document is a control failure", has(miss, "C6", "control", "fail", /QC-C6-0001/));
ok("Broken agents: C6 proposing the news story is a control failure", has(miss, "C6", "control", "fail", /news story/));
ok("Broken agents: C6 re-proposing a listed document is a control failure", has(miss, "C6", "control", "fail", /already in the library/));
ok("Broken agents: C6 proposal with no link fails", has(miss, "C6", "check", "fail", /no link/));
ok("Broken agents: C6 proposal from a news site warns", has(miss, "C6", "check", "warn", /news, blog or social.*statnews/));
ok("Broken agents: C6 proposal already in the library warns and is left out", has(miss, "C6", "check", "warn", /already holds/) && !readFileSync(join(root, "qc-out/library-additions.md"), "utf8").includes("Already listed (fake)]"));
ok("Broken agents: C6 proposal for a node that doesn't exist warns", has(miss, "C6", "check", "warn", /node that doesn't exist/));
ok("Broken agents: the reports say not to trust them", ["regulatory-scan", "library-versions", "library-additions"].every(f => readFileSync(join(root, `qc-out/${f}.md`), "utf8").includes("don't trust this report")));

for (const [k, re] of [["missing", /No API key is set/], ["expired", /expired, deleted, or mistyped/], ["broke", /out of credit/], ["limit", /spending cap/]]) {
  const s = run({ SITE_QC_FAKE_AI: `${here}/fake-good.json`, SITE_QC_FAKE_KEY: k });
  ok(`Key ${k}: every agent says so, none goes quiet`, ["C3", "C4", "S2", "C5", "C6"].every(id => has(s, id, "check", "fail", re)) && s.failedSite === 5);
}
const real = run({ SITE_QC_FAKE_AI: "", SITE_QC_ANTHROPIC_KEY: "" }, "C3");
ok("Real mode with no key set: says the key is missing", has(real, "C3", "check", "fail", /No API key is set/) && real.key === "missing");

const skip = run({ SITE_QC_FAKE_AI: `${here}/fake-good.json`, SITE_QC_SKIP: "C4,S2,C5,C6" });
ok("SITE_QC_SKIP=C4,S2,C5,C6: only C3 runs, and the run lists what it skipped", skip.skipped.join() === "C4,S2,C5,C6" && !skip.results.some(r => r.id !== "C3"));

console.log(bad ? `\n${bad} failed` : "\nAll passed");
process.exit(bad ? 1 : 0);
