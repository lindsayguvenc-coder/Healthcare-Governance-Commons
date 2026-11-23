// Checks the Site QC agents with fake AI replies only: nothing is sent to the
// AI and no key is used. Each scenario runs scripts/site-agents.mjs and checks
// what it reported. Run: node tests/site-qc/agents/run-fake.mjs
// (S2 drives the real pages, so it needs playwright in tests/replay and Chrome:
// CHROME=/usr/bin/google-chrome.)
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../../..", import.meta.url).pathname;
const here = "tests/site-qc/agents";
function run(env, only = "C3,C4,S2,C5,C6,C7,C8") {
  rmSync(join(root, "qc-out/site-agents.json"), { force: true });
  try { execFileSync("node", ["scripts/site-agents.mjs", "--only", only], { cwd: root, env: { ...process.env, SITE_QC_TODAY: "2026-11-23", SITE_QC_SKIP: "", ...env }, stdio: "pipe" }); } catch {}
  return JSON.parse(readFileSync(join(root, "qc-out/site-agents.json"), "utf8"));
}
let bad = 0;
const ok = (name, cond, extra = "") => { console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : "  " + extra}`); if (!cond) bad++; };
const has = (s, id, kind, level, re) => s.results.some(r => r.id === id && r.kind === kind && r.level === level && re.test(r.check + " " + r.detail));

const good = run({ SITE_QC_FAKE_AI: `${here}/fake-good.json` });
ok("Good replies: every planted test caught", good.failedControls === 0 && good.results.filter(r => r.kind === "control").length === 64, JSON.stringify(good.results.filter(r => r.kind === "control" && !r.ok)));
ok("Good replies: no failures", good.failedSite === 0, JSON.stringify(good.results.filter(r => r.level === "fail")));
ok("Good replies: C3 report names the finding", readFileSync(join(root, "qc-out/regulatory-scan.md"), "utf8").includes("HTI-6"));
ok("Good replies: C4 flags the found source for a Needs-source claim", has(good, "C4", "check", "warn", /Possible source/));
ok("Good replies: C5 reports the planted page that moved but still loads, and the real-shaped CHAI move", has(good, "C5", "check", "ok", /2 library finding\(s\)/) && readFileSync(join(root, "qc-out/library-versions.md"), "utf8").includes("CHAI Registry"));
ok("Good replies: C5 names both files to fix for a link the library and toolbox share", readFileSync(join(root, "qc-out/library-versions.md"), "utf8").includes("library.json: chai-applied-model-card; toolbox.json: chai-card"));
ok("Good replies: C5 reads CHAI's banner as one site-wide notice and the agent ties it to the model card", has(good, "C5", "check", "ok", /Site-wide notice on chai.org \(3 pages\), tied by the agent to chai-applied-model-card/));
ok("Good replies: C5 raises no backstop warning when the agent reported the move", !has(good, "C5", "check", "warn", /says it moved|Site-wide/));
ok("Good replies: C5 layer 1 flags CHAI's new banner once, by site, against last run's tops", has(good, "C5", "check", "warn", /Top of the page changed since 2026-11-16 on chai\.org \(3 pages, the same change on each\).*moved to the CHAI Registry/));
ok("Good replies: C5 layer 1's change is explained by the agent's finding, so it adds nothing to review", has(good, "C5", "check", "ok", /Top-of-page change on chai\.org \(3 pages\) explained/));
ok("Good replies: C5 saves this run's page tops for next time", JSON.parse(readFileSync(join(root, "qc-out/library-tops.json"), "utf8")).pages["chai-applied-model-card"]?.top.includes("CHAI Registry"));
ok("Good replies: C5 report says how each of the three layers looked, and the reader's planted banner", ["Layer 1, baseline compare:** against 2026-11-16", "Layer 2, closed-book AI reader:** read", "Planted banner (seed 1118)", "Layer 3, word pattern"].every(t => readFileSync(join(root, "qc-out/library-versions.md"), "utf8").includes(t)));
ok("Good replies: C6 report lists the proposal under its node", readFileSync(join(root, "qc-out/library-additions.md"), "utf8").includes("## contestation"));
ok("Good replies: C7 report lists the planted-free cluster with its documents, and says naming a node is Lindsay's call", ["## Patient notice when AI is used (fake)", "Naming a node, or not, is Lindsay's call", "example-agency.gov/disclosure-fake"].every(t => readFileSync(join(root, "qc-out/forming-scan.md"), "utf8").includes(t)));
ok("Good replies: C7 has one cluster to review and no warnings", has(good, "C7", "check", "ok", /^1 cluster\(s\) to review/) && !good.results.some(r => r.id === "C7" && r.level !== "ok"));
ok("Good replies: C8 triages the planted queue only, and says so", has(good, "C8", "check", "ok", /5 planted item\(s\) triaged \(the planted test file only/) && readFileSync(join(root, "qc-out/queue-triage.md"), "utf8").includes("Planted test file only"));
ok("Good replies: C8's report holds back the summary of an item with patient data", readFileSync(join(root, "qc-out/queue-triage.md"), "utf8").includes("(held back: patient data)") && !readFileSync(join(root, "qc-out/queue-triage.md"), "utf8").includes("bed 12"));
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
ok("Broken agents: C5 with no saved baseline says so out loud", has(miss, "C5", "check", "warn", /Layer 1 \(baseline compare\) had nothing to compare against/) && readFileSync(join(root, "qc-out/library-versions.md"), "utf8").includes("**nothing to compare against"));
ok("Broken agents: C5's AI reader missing the planted banner is a control failure", has(miss, "C5", "control", "fail", /AI reader flags the planted banner in made-up wording/));
ok("Broken agents: C5's AI reader flagging the page that only supersedes an old edition is a control failure", has(miss, "C5", "control", "fail", /AI reader leaves the planted page/));
ok("Broken agents: C5's AI reader quoting words that aren't on the page warns", has(miss, "C5", "check", "warn", /AI reader's quote isn't on the page: toolbox:tripod/));
ok("Broken agents: C5's AI reader flagging a page it wasn't given warns", has(miss, "C5", "check", "warn", /page it wasn't given: qc-c5-not-a-page/));
ok("Broken agents: C5's AI reader flag the agent didn't report warns and goes in the report", has(miss, "C5", "check", "warn", /AI reader says the page says it moved: toolbox:tripod.*agent didn't report/) && readFileSync(join(root, "qc-out/library-versions.md"), "utf8").includes("layer 2, AI reader"));
ok("Broken agents: C6 missing the planted document is a control failure", has(miss, "C6", "control", "fail", /QC-C6-0001/));
ok("Broken agents: C6 proposing the news story is a control failure", has(miss, "C6", "control", "fail", /news story/));
ok("Broken agents: C6 re-proposing a listed document is a control failure", has(miss, "C6", "control", "fail", /already in the library/));
ok("Broken agents: C6 proposal with no link fails", has(miss, "C6", "check", "fail", /no link/));
ok("Broken agents: C6 proposal from a news site warns", has(miss, "C6", "check", "warn", /news, blog or social.*statnews/));
ok("Broken agents: C6 proposal already in the library warns and is left out", has(miss, "C6", "check", "warn", /already holds/) && !readFileSync(join(root, "qc-out/library-additions.md"), "utf8").includes("Already listed (fake)]"));
ok("Broken agents: C6 proposal for a node that doesn't exist warns", has(miss, "C6", "check", "warn", /node that doesn't exist/));
ok("Broken agents: C7 missing the planted cluster is a control failure", has(miss, "C7", "control", "fail", /QC-C7-0001/));
ok("Broken agents: C7 proposing what an existing node holds is a control failure", has(miss, "C7", "control", "fail", /existing node holds/));
ok("Broken agents: C7 cluster with no document fails", has(miss, "C7", "check", "fail", /Cluster with no document/));
ok("Broken agents: C7 cluster from a news site warns", has(miss, "C7", "check", "warn", /news, blog or social site.*statnews/));
ok("Broken agents: C7 cluster with one document, an existing node's name, and a node that doesn't exist warns", ["only one document", "existing node's name: Explainability", "node that doesn't exist: nope"].every(t => has(miss, "C7", "check", "warn", new RegExp(t))));
for (const [what, re] of [["spam", /planted spam/], ["patient details no pattern catches", /without a pattern/], ["patient name", /planted patient name/], ["duplicate", /planted duplicate/], ["clean item", /clean item is left alone/], ["node", /clean item's node/], ["summary", /doesn't repeat them/]])
  ok(`Broken agents: C8 missing the planted ${what} is a control failure`, has(miss, "C8", "control", "fail", re));
ok("Broken agents: C8's code backstop catches the patient name the agent passed", has(miss, "C8", "check", "fail", /Code backstop found a patient name the agent didn't flag: qc-c8-strong-phi/));
ok("Broken agents: C8 summary repeating a patient name fails", has(miss, "C8", "check", "fail", /A summary repeats a patient name: qc-c8-strong-phi/));
ok("Broken agents: C8 trying to decide fails", has(miss, "C8", "check", "fail", /tried to decide on qc-c8-strong-phi/));
ok("Broken agents: C8 duplicate link the agent missed, a node that doesn't exist, and an item it made up warn", [/Code found a duplicate link the agent didn't: qc-c8-dup and qc-c8-clean/, /node that doesn't exist: nowhere/, /isn't in the queue: qc-c8-made-up/].every(re => has(miss, "C8", "check", "warn", re)));
ok("Broken agents: the reports say not to trust them", ["regulatory-scan", "library-versions", "library-additions", "forming-scan", "queue-triage"].every(f => readFileSync(join(root, `qc-out/${f}.md`), "utf8").includes("don't trust this report")));

for (const [k, re] of [["missing", /No API key is set/], ["expired", /expired, deleted, or mistyped/], ["broke", /out of credit/], ["limit", /spending cap/]]) {
  const s = run({ SITE_QC_FAKE_AI: `${here}/fake-good.json`, SITE_QC_FAKE_KEY: k });
  ok(`Key ${k}: every agent says so, none goes quiet`, ["C3", "C4", "S2", "C5", "C6", "C7", "C8"].every(id => has(s, id, "check", "fail", re)) && s.failedSite === 7);
}
const real = run({ SITE_QC_FAKE_AI: "", SITE_QC_ANTHROPIC_KEY: "" }, "C3");
ok("Real mode with no key set: says the key is missing", has(real, "C3", "check", "fail", /No API key is set/) && real.key === "missing");

const skip = run({ SITE_QC_FAKE_AI: `${here}/fake-good.json`, SITE_QC_SKIP: "C4,S2,C5,C6,C7,C8" });
ok("SITE_QC_SKIP=C4,S2,C5,C6,C7,C8: only C3 runs, and the run lists what it skipped", skip.skipped.join() === "C4,S2,C5,C6,C7,C8" && !skip.results.some(r => r.id !== "C3"));

// C8's hard stop (decided Nov 23): it reads only its planted test file, whatever it's handed, and nothing turns it on
// for real submissions. A variable or an argument that tries to give it another input is refused, and it writes no report.
for (const [how, env, args] of [["a variable", { SITE_QC_C8_INPUT: "qc-out/real-queue.json" }, []], ["a queue variable", { SITE_QC_QUEUE: "redis://x" }, []], ["an argument", {}, ["--input", "qc-out/real-queue.json"]]]) {
  rmSync(join(root, "qc-out/queue-triage.md"), { force: true });
  rmSync(join(root, "qc-out/site-agents.json"), { force: true });
  try { execFileSync("node", ["scripts/site-agents.mjs", "--only", "C8", ...args], { cwd: root, env: { ...process.env, SITE_QC_TODAY: "2026-11-23", SITE_QC_SKIP: "", SITE_QC_FAKE_AI: `${here}/fake-good.json`, ...env }, stdio: "pipe" }); } catch {}
  const r = JSON.parse(readFileSync(join(root, "qc-out/site-agents.json"), "utf8"));
  ok(`C8 hard stop: another input through ${how} is refused, and nothing is triaged`, has(r, "C8", "check", "fail", /Refused to run: something tried to give C8 another input/) && !existsSync(join(root, "qc-out/queue-triage.md")));
}
const src = readFileSync(join(root, "scripts/site-agents.mjs"), "utf8");
const c8 = src.slice(src.indexOf("// ── C8: review queue triage"), src.indexOf("// ── Run ──"));
ok("C8 hard stop: its code never reaches the real queue (no Redis, no queue code, no fetch, one fixed input)",
  c8.length > 1000 && !/getRedis|ioredis|_queue|PENDING|suggest:|fetch\(|readFileSync|process\.env\.SITE_QC_C8/.test(c8) && (c8.match(/triageInput\(/g) || []).length === 2 && /triageInput\(C8_ONLY_INPUT\)/.test(c8));
ok("C8 is in no schedule and no dispatch list: it runs only when named", !/C8/.test(readFileSync(join(root, ".github/workflows/site-agents.yml"), "utf8")) && /"C3,C4,S2,C5,C6,C7"\)\.split/.test(src));

console.log(bad ? `\n${bad} failed` : "\nAll passed");
process.exit(bad ? 1 : 0);
