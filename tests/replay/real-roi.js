// Real runs of the ROI Assessment: the real page, the real relay (api/_relay.js), and
// the real model. Made-up organizations only. Needs ANTHROPIC_API_KEY in the
// environment (use a short-lived, spend-capped key and delete it after).
// The report pause is stubbed off for this local run only.
// Usage: ANTHROPIC_API_KEY=... node real-roi.js <repo> <outDir> [path-to-chrome]
const http = require("http");
const fs = require("fs");
const path = require("path");
const Module = require("module");
const { chromium } = require("playwright");

const repo = path.resolve(process.argv[2]);
const out = path.resolve(process.argv[3]);
const chrome = process.argv[4];
fs.mkdirSync(out, { recursive: true });
if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY not set"); process.exit(1); }

// No Redis here: give the relay a stub module (rate limiting fails open without REDIS_URL).
const stub = path.join(out, "ioredis-stub.js");
fs.writeFileSync(stub, "module.exports = function Redis() {};");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) {
  if (req === "ioredis") return stub;
  return origResolve.call(this, req, ...rest);
};
const pauseFile = path.join(repo, "api/_pause.js");
require.cache[pauseFile] = { id: pauseFile, filename: pauseFile, loaded: true,
  exports: { TOOLS: ["vpg", "roi", "transition"], pausedTools: () => [], isPaused: () => false } };
const { relay } = require(path.join(repo, "api/_relay.js"));

const pub = path.join(repo, "public");
const types = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".json": "application/json", ".svg": "image/svg+xml" };
const log = [];
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host}`);
  if (u.pathname === "/api/synthesize") {
    let raw = ""; for await (const c of req) raw += c;
    req.body = JSON.parse(raw);
    const started = Date.now();
    const shim = { code: 200, status(c) { this.code = c; return this; },
      json(o) { log.push({ ms: Date.now() - started, status: this.code, stop: o.stop_reason, usage: o.usage, blocks: (o.content || []).map(b => b.type),
          text: (o.content || []).filter(b => b.type === "text").map(b => b.text).join("") });
        res.writeHead(this.code, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); } };
    return relay(req, shim);
  }
  if (u.pathname === "/api/status") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end('{"pausedTools":[],"reportsPaused":false}'); }
  let f = path.join(pub, decodeURIComponent(u.pathname));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!f.startsWith(pub) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});

const BASE = {
  q_pathway: "Ongoing — system is deployed, assessing value or continuation",
  q_setting: "Outpatient / ambulatory", q_role: "Governance or AI oversight committee",
};
const SCENARIOS = {
  scribe: { ...BASE,
    q_system: "Example Ambient Scribe", q_use_type: "Ambient scribe / AI documentation — drafts notes from the visit",
    q_org: "Example Community Health", q_deployment_duration: "6–12 months",
    q_strategy: "Yes — documented and in active use",
    q_strategy_priorities: ["Improve patient safety", "Support and retain staff", "Advance health equity"],
    q_roi_defined: "Yes — defined but informally", q_exit_threshold: "Not yet defined", q_recheck: "Re-check date set, no payoff date",
    q_clinical_expected: ["Improved clinical documentation quality"], q_clinical_status: "Formally measured with local data", q_clinical_result: "Value questioned",
    q_baseline: "No", q_adoption: "About half", q_time_went: ["More patient visits"], q_check_hours: "Not tracked", q_check_who: ["The clinicians using it"],
    q_operational_expected: ["Reduced workflow time", "Reduced clinician cognitive burden"], q_operational_status: "Yes — informal feedback collected",
    q_alert_fatigue: "Not applicable — system does not generate alerts", q_alert_rate: "Not applicable — system does not alert or flag", q_override_rate: "Not tracked",
    q_scribe_time: "Measured locally", q_scribe_quality: "Clinicians edit, but no structured review", q_scribe_consent: "Verbal or informal",
    q_cost: "$150,000 – $500,000", q_assurance_cost: "No — not included",
    q_financial_categories: ["Improved revenue capture or billing accuracy", "Avoided staff turnover costs — tool provides workflow relief"],
    q_coding_source: "Yes — a main part", q_coding_audit: "Spot checks", q_coding_review: "No — codes go out without clinician review", q_coding_patient: "No",
    q_financial_analysis: "Yes — partial analysis", q_exit_cost: "High — locked in (long contract, data, retraining)", q_alternatives: "No",
    q_equity_relevant: "Yes — high relevance", q_equity_populations: ["Language / health literacy", "Insurance / payer type"],
    q_equity_analysis: "No — not yet conducted", q_harm_tracked: "Yes — informally monitored",
    q_community_trust: "No — not assessed", q_community_impact: "Not yet assessed",
    q_staff_trust: "Mixed — divided response", q_burnout_measured: "Yes — before and after", q_patient_trust: "Unknown — not assessed",
    q_evidence_overall: "Strong — robust data across multiple dimensions",
    q_biggest_unknown: "Whether the extra revenue is real care we used to miss or just higher codes.",
    q_opponents: "Two primary care leads think it pushes visit volume, not relief.",
  },
  sepsis: { ...BASE, q_setting: "Inpatient — general medical/surgical",
    q_system: "Example Sepsis Early Warning", q_use_type: "Risk stratification — identifies patients for intervention",
    q_org: "Example Regional Medical Center", q_deployment_duration: "1–2 years",
    q_strategy: "Yes — documented and in active use", q_strategy_priorities: ["Improve patient safety", "Improve clinical quality and outcomes"],
    q_strategy_criteria: "Yes — formal criteria", q_strategy_describe: "Sunset if sensitivity at our threshold drops below the level set at go-live for two straight quarters.",
    q_roi_defined: "Yes — defined and measurable", q_exit_threshold: "Yes — formally defined",
    q_exit_describe: "Two quarters below the go-live sensitivity, or any subgroup gap above the committee's set limit.", q_recheck: "Payoff date and re-check date both set",
    q_clinical_expected: ["Faster time to diagnosis or intervention", "Reduced adverse events"], q_clinical_status: "Formally measured with local data", q_clinical_result: "Mixed, or too early to say",
    q_baseline: "Yes — for the main measures", q_adoption: "Most (75% or more)", q_time_went: ["Unknown"], q_check_hours: "Estimated, not measured", q_check_who: ["The clinicians using it", "A separate reviewer or QA team"],
    q_operational_expected: ["Reduced alert fatigue"], q_operational_status: "Yes — formal study or analysis",
    q_alert_fatigue: "Yes — formally assessed", q_alert_rate: "Yes — tracked and reviewed", q_override_rate: "Yes — tracked and reviewed",
    q_cost: "$500,000 – $1,000,000", q_assurance_cost: "Partly", q_financial_categories: ["Avoided downstream costs (prevented adverse events, shorter LOS)"],
    q_financial_analysis: "Yes — full cost-benefit or ROI analysis", q_exit_cost: "Moderate — contract or workflow to unwind", q_alternatives: "Yes",
    q_equity_relevant: "Yes — high relevance", q_equity_populations: ["Race / ethnicity", "Age"], q_equity_analysis: "Yes — formal, published or internal report",
    q_harm_tracked: "Yes — formal incident reporting includes AI involvement", q_community_trust: "Not applicable", q_community_impact: "Not applicable",
    q_staff_trust: "Moderate — generally accepted with some skepticism", q_burnout_measured: "No", q_patient_trust: "Not applicable",
    q_evidence_overall: "Moderate — solid data on some dimensions, weak or assumed on others",
  },
  radiology_pre: { ...BASE, q_pathway: "Pre-adoption — evaluating whether to adopt", q_setting: "Emergency department",
    q_system: "Example Head CT Triage", q_use_type: "Triage / prioritization — direct impact on care sequencing", q_role: "Procurement or pre-adoption evaluation team",
    q_strategy: "Yes — in development", q_strategy_priorities: ["Improve patient safety", "Increase operational efficiency"],
    q_roi_defined: "No — not yet defined", q_exit_threshold: "This decision has not been formally considered", q_recheck: "Neither set",
    q_clinical_expected: ["Faster time to diagnosis or intervention"], q_clinical_status: "Strong vendor and peer-reviewed evidence",
    q_baseline: "Not planned", q_check_hours: "Not estimated", q_check_who: ["Unknown"],
    q_operational_expected: ["Improved throughput"], q_operational_status: "No — not yet assessed", q_alert_fatigue: "No — not assessed",
    q_cost: "Not disclosed by vendor", q_assurance_cost: "Unknown", q_financial_categories: ["Avoided downstream costs (prevented adverse events, shorter LOS)"],
    q_financial_analysis: "No — not yet conducted", q_exit_cost: "Unknown", q_alternatives: "No",
    q_equity_relevant: "Uncertain", q_equity_analysis: "No — not yet conducted", q_harm_tracked: "No — not yet tracked",
    q_staff_trust: "Not yet deployed to clinical staff", q_evidence_overall: "Strong — robust data across multiple dimensions",
    q_champion_question: "Can I say it will get stroke patients to treatment faster here?",
  },
  agent_nostrategy: { ...BASE, q_setting: "Multi-setting",
    q_system: "Example Prior Auth Agent", q_use_type: "Agentic workflow — takes actions across steps or systems", q_role: "Executive or administrative leadership",
    q_strategy: "No — not yet developed", q_roi_defined: "Yes — defined but informally", q_exit_threshold: "Not yet defined",
    q_clinical_expected: ["None identified yet"], q_clinical_status: "Not yet measured",
    q_baseline: "For some measures", q_adoption: "Not tracked", q_check_hours: "Measured — eats most or all of the time it saves", q_check_who: ["Nobody in particular"],
    q_operational_expected: ["Reduced redundant work", "Improved throughput"], q_operational_status: "Yes — formal study or analysis",
    q_agent_actions: "Actions that change orders, records, or patient messages", q_agent_log: "Logged but not reviewed",
    q_cost: "$50,000 – $150,000", q_assurance_cost: "No — not included", q_financial_categories: ["Reduced labor cost (e.g., fewer manual reads or reviews)"],
    q_financial_analysis: "Informal estimates only", q_exit_cost: "Low — easy to switch off", q_alternatives: "Unknown",
    q_equity_relevant: "No — low relevance for this use", q_equity_analysis: "No — not yet conducted", q_harm_tracked: "No — and this is a known gap",
    q_staff_trust: "High — strong buy-in across the team", q_evidence_overall: "Moderate — solid data on some dimensions, weak or assumed on others",
  },
  thin: { ...BASE, q_system: "Thin Example", q_use_type: "Decision support at point of care", q_setting: "Emergency department",
    q_role: "Executive or administrative leadership", q_strategy: "Unknown", q_roi_defined: "Unknown", q_exit_threshold: "Unknown",
    q_clinical_expected: ["None identified yet"], q_clinical_status: "Unknown", q_operational_expected: ["None identified yet"],
    q_operational_status: "Unknown", q_cost: "Not known", q_assurance_cost: "Unknown", q_financial_categories: ["None identified yet"],
    q_financial_analysis: "Unknown", q_equity_relevant: "Uncertain", q_equity_analysis: "Unknown", q_harm_tracked: "Unknown",
    q_staff_trust: "Unknown — not assessed", q_evidence_overall: "Strong — robust data across multiple dimensions" },
};

(async () => {
  await new Promise(r => server.listen(4320, r));
  const browser = await chromium.launch(chrome ? { executablePath: chrome } : {});
  const page = await (await browser.newContext({ viewport: { width: 1100, height: 900 } })).newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  const results = {};
  const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
  const runs = process.env.RUNS ? Number(process.env.RUNS) : 1;
  for (const [name0, answers] of Object.entries(SCENARIOS).filter(([n]) => !only || only.includes(n)).flatMap(e => Array.from({ length: runs }, (_, i) => [e[0] + (runs > 1 ? "_" + (i + 1) : ""), e[1]]))) {
    const name = name0;
    await page.goto("http://localhost:4320/roi-assessment/index.html");
    await page.waitForTimeout(300);
    await page.evaluate(ans => { state.answers = JSON.parse(JSON.stringify(ans)); state.phase = "elicit"; state.sectionIdx = 5; }, answers);
    const n = log.length;
    await page.evaluate(() => goToGenerate());
    await page.waitForSelector(".report-phase, .error-phase", { timeout: 120000 });
    await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
    const report = await page.evaluate(() => state.report);
    results[name] = { call: log[n], report };
    console.log(name, JSON.stringify(log[n]), report && report.aiProblem ? "AI PROBLEM: " + report.aiProblem : "ok");
  }
  results.errors = errors;
  fs.writeFileSync(path.join(out, "real-results.json"), JSON.stringify(results, null, 2));
  await browser.close();
  server.close();
})().catch(e => { console.error(e); process.exit(1); });
