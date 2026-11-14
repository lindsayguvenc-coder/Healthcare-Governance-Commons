// api/vpg-engines.js
// Consolidated VPG engine route — Items 11, 12, 13 in one function.
// Dispatches to the correct engine based on the `engine` param.
// Called by api/generate-protocol.js in parallel for each engine.
//
// POST body: { engine: 'westgard' | 'bias' | 'nodes', answers, logicFlags, gapFlags }

const { mapAnswers } = require("./_answer-map.js");

// Numeric answer or null. Unlike `parseFloat(x) || null`, a real 0 survives.
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { engine, logicFlags = [], gapFlags = [] } = req.body;
    // Idempotent: generate-protocol already maps, direct callers get mapped here.
    const answers = mapAnswers(req.body.answers || {});

    if (!engine) {
      return res.status(400).json({ error: 'Missing engine param. Use: westgard | bias | nodes' });
    }

    let result;
    if (engine === 'westgard') {
      result = buildWestgardTiers({ answers, logicFlags, gapFlags });
    } else if (engine === 'bias') {
      const isFullProtocol = !logicFlags.includes('WORKFLOW_SUMMARY_MODE');
      result = runBiasCrossref({ answers, logicFlags, gapFlags, isFullProtocol });
    } else if (engine === 'nodes') {
      result = mapCommonsNodes({ answers, logicFlags, gapFlags });
    } else {
      return res.status(400).json({ error: `Unknown engine: ${engine}` });
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('vpg-engines error:', err);
    return res.status(500).json({ error: 'Engine failed', detail: err.message });
  }
}

// ─── Core builder ────────────────────────────────────────────────────────────

function buildWestgardTiers({ answers, logicFlags, gapFlags }) {
  const useType = answers.Q2 || "unknown";
  const sensitivity = num(answers.Q15);
  const specificity = num(answers.Q16);
  const prevalence = num(answers.Q17);
  const counts = {
    tp: num(answers.Q_tp), fn: num(answers.Q_fn), tn: num(answers.Q_tn), fp: num(answers.Q_fp),
  };
  const extra = {
    auc: num(answers.Q_auc),
    falseAlarmsPerCatch: num(answers.Q_false_alarms),
    calibration: answers.q_calibration || null,
    calibrationValues: answers.q_calibration_values || null,
    subgroup: answers.q_subgroup || null,
    subgroupDetail: answers.q_subgroup_detail || null,
    override: answers.q_override || null,
  };
  const floorSens = num(answers.Q_floor_sens);
  const floorSpec = num(answers.Q_floor_spec);
  const customWarn = num(answers.Q_warn_pct);
  const customAction = num(answers.Q_action_pct);
  const population = answers.Q8 || null;
  const decisionWindow = answers.Q24 || null;
  const corrActOwner = answers.Q28 || null;
  const priorAuditData = answers.Q35 === "yes";
  const driftDefined = answers.Q36 === "yes";
  const isHighRisk = logicFlags.includes("HIGH_AUTONOMY") || logicFlags.includes("DIRECT_CLINICAL_DECISION");
  const isFullProtocol = !logicFlags.includes("WORKFLOW_SUMMARY_MODE");

  // Derive PPV/NPV if possible
  const metrics = deriveMetrics({ sensitivity, specificity, prevalence, counts, extra });

  // Select tier profile based on use type
  const tierProfile = selectTierProfile(useType, isHighRisk, metrics, decisionWindow, { customWarn, customAction, floorSens, floorSpec });

  // Apply Westgard rule mapping
  const westgardMapping = mapWestgardRules(tierProfile, metrics, priorAuditData);

  // Population-stratified control limits
  const stratifiedLimits = buildStratifiedLimits(population, metrics, tierProfile);

  // Governance ownership statement
  const ownershipStatement = buildOwnershipStatement(corrActOwner, useType);

  // AI-specific additions (Commons review, Oct 2026)
  const controlMaterial = buildControlMaterial(tierProfile);
  const ruleSetPerformance = simulateRuleSetPerformance();
  const prevalenceMonitoring = buildPrevalenceMonitoring(metrics);
  const changeControl = buildChangeControl(tierProfile);
  const lookback = buildLookback(tierProfile, answers);
  const responseLayer = buildResponseLayer(answers);
  const aiValidation = buildAiValidation(tierProfile);

  // Short tracks (Nov 12, 2026): scribes and agents get their own measures and flags
  const track = useType === "generative_documentation" ? "scribe" : useType === "agentic_workflow" ? "agent" : null;
  const trackResult = track ? buildTrackMetrics(track, answers) : null;
  if (track) tierProfile.thresholds.isTrack = true;

  // Gap flags for tier section
  const tierGapFlags = [];
  // Workflow tests, Nov 14, 2026 (F7, F8). These go first: they change whether the rest matters.
  const pctOf = (x) => Math.round(x * 1000) / 10;
  if (!track && metrics.sensitivity !== null && floorSens !== null && pctOf(metrics.sensitivity) < floorSens)
    tierGapFlags.push(`Measured sensitivity (${pctOf(metrics.sensitivity)}%) is already below the stop-using point (${floorSens}%). By the organization's own rule, this model should not be in use. Resolve that before monitoring it.`);
  if (!track && metrics.specificity !== null && floorSpec !== null && pctOf(metrics.specificity) < floorSpec)
    tierGapFlags.push(`Measured specificity (${pctOf(metrics.specificity)}%) is already below the stop-using point for specificity (${floorSpec}%). By the organization's own rule, this model should not be in use.`);
  if (customWarn !== null && customAction !== null && customWarn >= customAction)
    tierGapFlags.push(`The warning shift (${customWarn}%) is not smaller than the reject shift (${customAction}%). A warning is meant to come first; as set, the model would be held before it ever warns. Make the reject shift the larger one.`);
  if (trackResult) tierGapFlags.push(...trackResult.flags);
  if (!track) if (metrics.sensitivity !== null && !metrics.hasCounts) tierGapFlags.push("Validation counts not provided, so no confidence intervals. A sensitivity from 30 positive cases carries roughly ±15 points of uncertainty; one from 3,000 carries about ±1.5. Enter the four counts to see which you have.");
  if (metrics.hasCounts && metrics.positives < 30) tierGapFlags.push(`Only ${metrics.positives} positive cases in the validation set. The sensitivity interval is wide (${metrics.sensCIDisplay}); treat the baseline as provisional.`);
  if (customWarn === null) tierGapFlags.push("Warning and reject shifts not chosen locally. The allowable-error defaults are the Commons' position, not a standard.");
  if (!track) if (metrics.sensitivity !== null && floorSens === null) tierGapFlags.push("No stop-using point set for sensitivity. The tool no longer invents one. Set the lowest sensitivity you would accept from intended use and harm; until then there is no hard stop on missed cases.");
  // AUROC caution lives in the metrics note, not the gap list (it is not something to close)
  if (metrics.calculable && metrics.netBenefit === null) tierGapFlags.push("Net benefit not computed: the trade-off question (false alarms accepted per caught case) was not answered.");
  if (metrics.netBenefit !== null && metrics.netBenefit <= metrics.netBenefitTreatAll) tierGapFlags.push("At your stated trade-off, the model does no better than treating everyone as positive. That is a reason to question the deployment, not just tune it.");
  if (metrics.netBenefit !== null && metrics.netBenefit <= 0) tierGapFlags.push("At your stated trade-off, net benefit is zero or negative: the false alarms cost more than the cases caught are worth.");
  if (/not measured/i.test(extra.calibration || "")) tierGapFlags.push("The model gives a probability, but calibration was not measured. A 30% risk score should mean about 30 in 100 such patients have the outcome; check it (calibration plot, Brier score or ECE) before anyone reads the score as a probability.");
  if (extra.subgroup && !/^Yes/.test(extra.subgroup)) tierGapFlags.push("No per-group performance numbers. Comparing how groups are recorded is not the same as knowing how the model performs for each group. Run the same measures per group; small groups give wide intervals, so report them.");
  if (extra.override && !/^Yes — source defined/.test(extra.override) && !/^Not applicable/.test(extra.override)) tierGapFlags.push("Override rate not planned with a data source. How often clinicians dismiss alerts is the earliest sign of alert fatigue; decide where it comes from before go-live.");
  if (!track) if (tierProfile.generative) tierGapFlags.push("Generative or agentic use type — sensitivity/specificity do not apply directly. Grader validation and acceptable cutoffs must be defined (see AI-specific validation additions).");
  if (!track) if (sensitivity === null) tierGapFlags.push("Sensitivity not provided — warning thresholds estimated from use-type defaults.");
  if (!track) if (specificity === null) tierGapFlags.push("Specificity not provided — tier bounds are indicative only.");
  if (!track) if (prevalence === null) tierGapFlags.push("Local prevalence unknown — PPV/NPV cannot be calculated; fixed thresholds used.");
  if (!corrActOwner) tierGapFlags.push("Corrective action owner not designated — governance accountability is unassigned.");
  if (!driftDefined) tierGapFlags.push("Drift criteria not pre-defined — recommending threshold review at 90-day intervals until criteria established.");

  return {
    section: "monitoring_tiers",
    useType,
    isFullProtocol,
    metrics,
    tierProfile,
    westgardMapping,
    stratifiedLimits,
    ownershipStatement,
    controlMaterial,
    ruleSetPerformance,
    prevalenceMonitoring,
    changeControl,
    lookback,
    responseLayer,
    aiValidation,
    track,
    trackResult,
    tierGapFlags,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Metric derivation ────────────────────────────────────────────────────────

// Wilson score interval (95%). One of the two the Agent QC picker names; chosen here because
// it is closed-form and behaves well at small n and near 0% or 100%.
function wilson(x, n, z = 1.96) {
  if (!n) return null;
  const p = x / n, z2 = z * z, d = 1 + z2 / n;
  const c = (p + z2 / (2 * n)) / d;
  const h = (z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}
const pctStr = (v, d = 1) => `${(v * 100).toFixed(d)}%`;
const ciStr = (ci) => (ci ? `${pctStr(ci[0])}–${pctStr(ci[1])}` : null);

function deriveMetrics({ sensitivity, specificity, prevalence, counts = {}, extra = {} }) {
  const metrics = {
    sensitivity: sensitivity !== null ? sensitivity / 100 : null,
    specificity: specificity !== null ? specificity / 100 : null,
    prevalence: prevalence !== null ? prevalence / 100 : null,
    ppv: null,
    npv: null,
    likelihoodRatioPos: null,
    likelihoodRatioNeg: null,
    calculable: false,
    hasCounts: false,
    auc: extra.auc ?? null,
    netBenefit: null,
    netBenefitTreatAll: null,
  };

  // Counts beat percentages: they carry the sample size, so we can say how sure we are.
  const { tp, fn, tn, fp } = counts;
  if ([tp, fn, tn, fp].every((v) => v !== null && v !== undefined && v >= 0) && tp + fn > 0 && tn + fp > 0) {
    metrics.hasCounts = true;
    metrics.counts = { tp, fn, tn, fp };
    metrics.positives = tp + fn;
    metrics.negatives = tn + fp;
    metrics.n = tp + fn + tn + fp;
    metrics.sensitivity = tp / (tp + fn);
    metrics.specificity = tn / (tn + fp);
    metrics.sensCI = wilson(tp, tp + fn);
    metrics.specCI = wilson(tn, tn + fp);
    metrics.cohortPrevalence = (tp + fn) / metrics.n;
    metrics.cohortAlertRate = (tp + fp) / metrics.n;
    metrics.cohortAlertRateCI = wilson(tp + fp, metrics.n);
    if (tp + fp > 0) { metrics.cohortPPV = tp / (tp + fp); metrics.cohortPPVCI = wilson(tp, tp + fp); }
    // Prevalence for PPV/NPV: the local figure if given, else the validation set's own
    if (metrics.prevalence === null) { metrics.prevalence = metrics.cohortPrevalence; metrics.prevalenceSource = "validation set"; }
  }
  if (metrics.prevalence !== null && !metrics.prevalenceSource) metrics.prevalenceSource = "local estimate";

  if (metrics.sensitivity !== null && metrics.specificity !== null && metrics.prevalence !== null) {
    const se = metrics.sensitivity, sp = metrics.specificity, pr = metrics.prevalence;
    const tpR = se * pr, fpR = (1 - sp) * (1 - pr), fnR = (1 - se) * pr, tnR = sp * (1 - pr);
    metrics.ppv = tpR + fpR > 0 ? tpR / (tpR + fpR) : null;
    metrics.npv = tnR + fnR > 0 ? tnR / (tnR + fnR) : null;
    // 100% (or 0%) specificity makes a ratio undefined; leave it blank rather than print Infinity
    metrics.likelihoodRatioPos = sp < 1 ? se / (1 - sp) : null;
    metrics.likelihoodRatioNeg = sp > 0 ? (1 - se) / sp : null;
    // Alert rate at this prevalence: share of all patients the model flags
    metrics.alertRate = tpR + fpR;
    metrics.alertsPer100 = Math.round(metrics.alertRate * 1000) / 10;
    metrics.numberToEvaluate = metrics.ppv ? 1 / metrics.ppv : null;
    metrics.calculable = true;

    // Net benefit (Vickers decision-curve form): true positives minus false positives,
    // weighted by the exchange rate the organization states. "N false alarms per caught
    // case" means a threshold probability pt = 1/(1+N), weight pt/(1-pt) = 1/N.
    const N = extra.falseAlarmsPerCatch;
    if (N !== null && N !== undefined && N > 0) {
      const w = 1 / N;
      metrics.thresholdProbability = 1 / (1 + N);
      metrics.netBenefit = tpR - fpR * w;
      metrics.netBenefitTreatAll = pr - (1 - pr) * w;
      metrics.netBenefitDisplay = `${(metrics.netBenefit * 100).toFixed(1)} net true positives per 100 patients (treat everyone: ${(metrics.netBenefitTreatAll * 100).toFixed(1)}; treat no one: 0). Trade-off: ${N} false alarm${N === 1 ? "" : "s"} accepted per caught case.`;
    }
  }

  // Format for display
  if (metrics.ppv !== null) metrics.ppvDisplay = pctStr(metrics.ppv);
  if (metrics.npv !== null) metrics.npvDisplay = pctStr(metrics.npv);
  if (metrics.likelihoodRatioPos !== null) metrics.lrPosDisplay = metrics.likelihoodRatioPos.toFixed(2);
  if (metrics.likelihoodRatioNeg !== null) metrics.lrNegDisplay = metrics.likelihoodRatioNeg.toFixed(3);
  if (metrics.sensitivity !== null) metrics.sensDisplay = pctStr(metrics.sensitivity) + (metrics.sensCI ? ` (95% CI ${ciStr(metrics.sensCI)}, ${metrics.positives} positive cases)` : " (no interval: counts not given)");
  if (metrics.specificity !== null) metrics.specDisplay = pctStr(metrics.specificity) + (metrics.specCI ? ` (95% CI ${ciStr(metrics.specCI)}, ${metrics.negatives} negative cases)` : " (no interval: counts not given)");
  if (metrics.sensCI) metrics.sensCIDisplay = ciStr(metrics.sensCI);
  if (metrics.prevalence !== null) metrics.prevalenceDisplay = `${pctStr(metrics.prevalence)} (${metrics.prevalenceSource})`;
  if (metrics.alertRate !== undefined) metrics.alertRateDisplay = `${metrics.alertsPer100} of every 100 patients flagged` + (metrics.numberToEvaluate ? `; about ${Math.round(metrics.numberToEvaluate)} evaluated per true case` : "");
  if (metrics.auc !== null) metrics.aucDisplay = `${metrics.auc} (summarizes all thresholds, not yours; judge the model at your threshold)`;
  metrics.calibrationDisplay = extra.calibration
    ? extra.calibration + (extra.calibrationValues ? ` (${extra.calibrationValues})` : "")
    : "Not answered";
  metrics.subgroupDisplay = extra.subgroup
    ? extra.subgroup + (extra.subgroupDetail ? `: ${extra.subgroupDetail}` : "")
    : "Not answered";
  metrics.overrideDisplay = extra.override || "Not answered";

  return metrics;
}

// ─── Short tracks: scribes and agents ─────────────────────────────────────────

function rateRow(label, x, n, what) {
  if (x === null || n === null || !(n > 0) || x > n) return [label, "Not provided"];
  const ci = wilson(x, n);
  return [label, `${pctStr(x / n)} (95% CI ${ciStr(ci)}; ${x} of ${n} ${what})`];
}

function buildTrackMetrics(track, a) {
  const rows = [], flags = [];
  const yes = (v) => typeof v === "string" && v.startsWith("Yes");
  if (track === "scribe") {
    const n = num(a.qs_notes_n), fact = num(a.qs_notes_fact), omit = num(a.qs_notes_omit), floor = num(a.qs_floor);
    rows.push(rateRow("Notes with a factual error", fact, n, "notes"));
    rows.push(rateRow("Notes with an important omission", omit, n, "notes"));
    rows.push(["Stop-using point (error rate above)", floor !== null ? `${floor}% of notes (set by organization)` : "Not set. No default: set it from how notes are used."]);
    rows.push(["Who judged the notes", a.qs_grader || "Not answered"]);
    rows.push(["Transcription and speakers", a.qs_transcription ? a.qs_transcription + (a.qs_transcription_values ? ` (${a.qs_transcription_values})` : "") : "Not answered"]);
    rows.push(["Languages and interpreters", a.qs_language || "Not answered"]);
    rows.push(["Clinician review before signing", a.qs_review || "Not answered"]);
    rows.push(["Edit / rejection tracking", a.qs_edit_rate || "Not answered"]);
    rows.push(["Recording consent", a.qs_consent || "Not answered"]);
    rows.push(["Audio after drafting", a.qs_audio || "Not answered"]);
    if (n === null) flags.push("No local note review. Before go-live, review a set of drafted notes against what was said and count notes with factual errors and with important omissions. Vendor figures are not your patients or your clinicians.");
    if (n !== null && n < 100) flags.push(`Only ${n} notes reviewed. An error rate from a small set has a wide interval; treat it as provisional.`);
    if (/not checked|no written definition|Vendor-reported/i.test(a.qs_grader || "")) flags.push("The note grader is not validated. Write down what counts as a factual error and an omission, and check that two reviewers agree, before trusting the rate.");
    if (floor === null) flags.push("No stop-using point set. Decide the share of notes with factual errors at which you would stop, based on how the notes are used downstream.");
    if (floor !== null && n && fact !== null && (100 * fact / n) > floor) flags.unshift(`Measured: ${Math.round(1000 * fact / n) / 10}% of notes had a factual error, above the stop-using point (${floor}%). By the organization's own rule, it should not be in use.`);
    if (!yes(a.qs_review) || /not enforced/.test(a.qs_review || "")) flags.push("Clinician review is not enforced. Unreviewed drafts in the record are the main way scribe errors reach patients.");
    if (!/source defined/.test(a.qs_edit_rate || "")) flags.push("Edit and rejection rates are not tracked with a data source. They are the earliest sign that drafts got worse or that clinicians stopped reading them.");
    if (/Notice only|Not yet decided/.test(a.qs_consent || "") || !a.qs_consent) flags.push("Recording consent relies on notice or is undecided. In all-party consent states such as California, patient class actions (Sharp, Dec 2024; Sutter Health and MemorialCare, Apr 2026) argue notice is not enough. Get legal review. Check the current source; as of Nov 2026.");
    if (/vendor|Unknown/i.test(a.qs_audio || "")) flags.push("Audio retention by the vendor, or unknown. Put retention, deletion and any training use in the contract.");
    if (/^(No|Partly)/.test(a.qs_language || "")) flags.push("Not tested across the languages, accents and interpreter visits your patients have. Errors cluster there; report them per group.");
  } else {
    const runs = num(a.qa_runs), ok = num(a.qa_success), viol = num(a.qa_policy_viol), floor = num(a.qa_floor);
    rows.push(rateRow("Task success (correct end state)", ok, runs, "runs"));
    rows.push(rateRow("Runs with a policy violation", viol, runs, "runs"));
    rows.push(["Stop-using point (success below)", floor !== null ? `${floor}% (set by organization)` : "Not set. No default: set it from what a wrong action costs."]);
    rows.push(["Consistency (pass^k)", a.qa_repeat_k || a.qa_repeat || "Not answered"]);
    rows.push(["Tool calls checked", a.qa_toolcalls || "Not answered"]);
    rows.push(["Hard-to-undo actions", a.qa_irreversible || "Not answered"]);
    rows.push(["Human approval required for", a.qa_approval || (/^No/.test(a.qa_irreversible || "") ? "Not needed (read-only or drafts)" : "Not answered")]);
    rows.push(["Permissions", a.qa_permissions || "Not answered"]);
    rows.push(["Action log", a.qa_log || "Not answered"]);
    rows.push(["Stop / undo tracking", a.qa_override || "Not answered"]);
    if (runs === null) flags.push("No local task runs. Before go-live, run a fixed task set with known correct end states and judge the end state in the system, not the agent's report.");
    if (runs !== null && runs < 100) flags.push(`Only ${runs} task runs. A success rate from a small set has a wide interval; treat it as provisional.`);
    if (!(a.qa_repeat || "").startsWith("Yes")) flags.push("Tasks were not repeated. One pass does not show the agent passes reliably; run each task several times and report pass^k.");
    if (floor === null) flags.push("No stop-using point set. Decide the success rate below which you would stop, based on what a wrong action costs.");
    if (floor !== null && runs && ok !== null && (100 * ok / runs) < floor) flags.unshift(`Measured: ${Math.round(1000 * ok / runs) / 10}% task success, below the stop-using point (${floor}%). By the organization's own rule, it should not be in use.`);
    if (viol !== null && viol > 0) flags.push(`${viol} run(s) broke a policy. A right end state reached the wrong way still counts as a failure for governance.`);
    if (!/^No/.test(a.qa_irreversible || "") && !/^All/.test(a.qa_approval || "")) flags.push("It can take hard-to-undo actions without a human approving each one. Require approval for those actions, at least until the success rate is established.");
    if (!/^Yes/.test(a.qa_permissions || "")) flags.push("Permissions are not scoped to its tasks. An agent can only do the damage its access allows; limit it.");
    if (!/^Yes/.test(a.qa_log || "")) flags.push("Actions are not fully logged. Without a replayable log, lookback after a failure is not possible.");
    if (!/source defined/.test(a.qa_override || "")) flags.push("Stop / undo rate not tracked with a data source. It is the earliest sign of trouble in use.");
  }
  return { track, rows, flags };
}

// ─── Tier profile selection ───────────────────────────────────────────────────

const USE_TYPE_PROFILES = {
  // High-autonomy / direct clinical decision types
  diagnostic_primary: { riskClass: "high", falseNegBias: true, tierSensitivity: "high" },
  treatment_recommendation: { riskClass: "high", falseNegBias: false, tierSensitivity: "high" },
  triage_prioritization: { riskClass: "high", falseNegBias: true, tierSensitivity: "high" },
  risk_stratification: { riskClass: "high", falseNegBias: true, tierSensitivity: "high" },
  // Workflow / augmentation types
  workflow_prioritization: { riskClass: "moderate", falseNegBias: false, tierSensitivity: "moderate" },
  documentation_support: { riskClass: "moderate", falseNegBias: false, tierSensitivity: "moderate" },
  clinical_decision_support: { riskClass: "moderate", falseNegBias: true, tierSensitivity: "moderate" },
  // Administrative / operational types
  scheduling_optimization: { riskClass: "low", falseNegBias: false, tierSensitivity: "low" },
  billing_coding: { riskClass: "low", falseNegBias: false, tierSensitivity: "low" },
  operational_efficiency: { riskClass: "low", falseNegBias: false, tierSensitivity: "low" },
  // Questionnaire use types not covered above
  screening_flagging: { riskClass: "moderate", falseNegBias: true, tierSensitivity: "moderate" },
  retrospective_audit: { riskClass: "low", falseNegBias: false, tierSensitivity: "low" },
  // Generative / agentic: no single label per output; graded instead
  generative_documentation: { riskClass: "moderate", falseNegBias: false, tierSensitivity: "moderate", generative: true },
  agentic_workflow: { riskClass: "high", falseNegBias: false, tierSensitivity: "high", generative: true },
  unknown: { riskClass: "moderate", falseNegBias: false, tierSensitivity: "moderate" },
};

function selectTierProfile(useType, isHighRisk, metrics, decisionWindow, custom = {}) {
  const baseProfile = USE_TYPE_PROFILES[useType] || USE_TYPE_PROFILES.unknown;
  const riskClass = isHighRisk ? "high" : baseProfile.riskClass;

  // Tighten thresholds if PPV is low (high false positive burden)
  const ppvLow = metrics.ppv !== null && metrics.ppv < 0.6;
  // Tighten if NPV is low and we're false-neg biased (missing true positives is worse)
  const npvLow = metrics.npv !== null && metrics.npv < 0.85 && baseProfile.falseNegBias;

  // Decision window affects tier sensitivity — shorter window = tighter thresholds
  const urgentWindow = decisionWindow && ["real_time", "minutes", "hours"].includes(decisionWindow);

  const tierSensitivity = (ppvLow || npvLow || urgentWindow || riskClass === "high")
    ? "high"
    : baseProfile.tierSensitivity;

  return {
    riskClass,
    tierSensitivity,
    falseNegBias: baseProfile.falseNegBias,
    ppvLow,
    npvLow,
    urgentWindow,
    generative: !!baseProfile.generative,
    thresholds: deriveThresholds(riskClass, tierSensitivity, metrics, custom),
  };
}

function deriveThresholds(riskClass, tierSensitivity, metrics, custom = {}) {
  // Allowable-error defaults by risk class: % degradation from the validated baseline.
  // These are STARTING POINTS for the organization to set locally, not standards.
  // They govern how much change is tolerable (update gating, action levels).
  // Day-to-day QC limits are set in SD units of each control metric (see Westgard rules).
  const BASE = {
    // Settings registry names: allowable.shift (warning and reject levels).
    // No stop level here: the stop-using point is the organization's to set, with no default (Nov 14, 2026).
    high: {
      warning: 3,   // 3% degradation triggers warning review
      action: 7,    // 7% degradation: reject (hold, corrective action)
    },
    moderate: {
      warning: 5,
      action: 12,
    },
    low: {
      warning: 8,
      action: 18,
    },
  };

  const base = BASE[riskClass] || BASE.moderate;

  // Tighten thresholds if high tier sensitivity
  const factor = tierSensitivity === "high" ? 0.75 : tierSensitivity === "low" ? 1.3 : 1.0;

  const thresholds = {
    warning: Math.round(base.warning * factor * 10) / 10,
    action: Math.round(base.action * factor * 10) / 10,
    source: "Commons position, not a standard",
  };
  // The organization's own choices (q22 / q23) replace the defaults
  if (custom.customWarn !== null && custom.customWarn !== undefined) { thresholds.warning = custom.customWarn; thresholds.source = "set by organization"; }
  if (custom.customAction !== null && custom.customAction !== undefined) {
    thresholds.action = custom.customAction; thresholds.source = "set by organization";
  }

  // Absolute floors are the organization's to set. Until Nov 12, 2026 the tool derived them
  // by trimming validated sensitivity 3-7% (specificity 2-5%); those cuts had no source.
  if (custom.floorSens !== null && custom.floorSens !== undefined) thresholds.sensitivityFloor = `${custom.floorSens}%`;
  if (custom.floorSpec !== null && custom.floorSpec !== undefined) thresholds.specificityFloor = `${custom.floorSpec}%`;

  return thresholds;
}

// ─── Westgard rule mapping ────────────────────────────────────────────────────

function mapWestgardRules(tierProfile, metrics, priorAuditData) {
  const { thresholds, falseNegBias } = tierProfile;

  // Westgard rules run on CONTROL results: known-answer control tasks run on a schedule.
  // Limits are in SD units of each control metric, measured during baseline (the noise
  // of the metric itself), not fixed percentages. Binary control results (correct /
  // incorrect) use a count of failures per window against exact binomial limits instead.
  const rules = [
    {
      westgardAnalog: "1₂ₛ (Warning rule)",
      mlTranslation: "One control result beyond ±2 SD of the baseline control mean",
      threshold: "±2 SD (SD measured across baseline control runs)",
      response: "Warning. Inspect with the other rules before acting. No stop.",
      tier: "warning",
      active: true,
    },
    {
      westgardAnalog: "1₃ₛ (Rejection rule)",
      mlTranslation: "One control result beyond ±3 SD",
      threshold: "±3 SD",
      response: "Reject the run. Execute the predetermined response (backup, contingency or hold) and notify the corrective action owner.",
      tier: "reject",
      active: true,
    },
    {
      westgardAnalog: "2₂ₛ (Systematic rule)",
      mlTranslation: "Two consecutive control results beyond 2 SD on the same side",
      threshold: "2 consecutive beyond 2 SD, same side",
      response: "Reject. Systematic error: check what changed (model version, prompt, configuration, data pipeline).",
      tier: "reject",
      active: true,
    },
    {
      westgardAnalog: "R₄ₛ (Random-error rule)",
      mlTranslation: "Two consecutive control results more than 4 SD apart, on opposite sides",
      threshold: "Range > 4 SD between consecutive results",
      response: "Reject. Random error: inspect components (input handling, tools, sampling settings). Subgroup differences are checked separately (see stratified limits).",
      tier: "reject",
      active: true,
    },
    {
      westgardAnalog: "4₁ₛ (Shift rule)",
      mlTranslation: "Four consecutive control results beyond 1 SD on the same side",
      threshold: "4 consecutive beyond 1 SD, same side",
      response: "Warning by default (reject if the validated rule set says so). Early systematic shift: investigate before it crosses 2 SD.",
      tier: "warning",
      active: priorAuditData,
      note: priorAuditData ? null : "Phased in once a baseline of at least 20 control runs exists.",
    },
    {
      westgardAnalog: "10ₓ (Drift rule)",
      mlTranslation: "Ten consecutive control results on the same side of the baseline mean",
      threshold: "10 consecutive, same side of mean",
      response: "Reject. Sustained systematic drift: hold, find the cause, and classify the change (re-baseline, verification or revalidation).",
      tier: "reject",
      active: priorAuditData,
      note: priorAuditData ? null : "Phased in once a baseline of at least 20 control runs exists.",
    },
    {
      westgardAnalog: "Fail count (binary controls)",
      mlTranslation: "Failed known-answer controls in the last 20 runs, against exact binomial limits from the baseline pass rate",
      threshold: "Warn at ~5% false-alarm limit; reject at ~0.3%",
      response: "Binary results have no distance from the mean, so they are judged as a count. Baseline rate starts provisional and is established with cumulative in-control runs.",
      tier: "reject",
      active: true,
    },
  ];

  if (falseNegBias) {
    rules.push({
      westgardAnalog: "Stop-using point: sensitivity (adapted)",
      mlTranslation: "Sensitivity on known-positive controls drops below an absolute floor",
      threshold: thresholds.sensitivityFloor ? `Sensitivity < ${thresholds.sensitivityFloor} (set by organization)` : "No floor set. The organization must set one; the tool does not supply a default.",
      response: "Immediate stop. Missed true positives carry the higher harm for this use type. Failover to human review.",
      tier: "stop",
      active: !!thresholds.sensitivityFloor,
      note: "False-negative bias declared for this use type. The floor is a hard stop, not a warning.",
    });
  }

  const phaseInNote = priorAuditData
    ? "Allowable error (% degradation) is separate from these QC limits: it governs how much change is tolerable when a model or configuration changes and sets reject levels for periodic evaluation."
    : "Shift and drift rules (4₁ₛ, 10ₓ) need at least 20 control runs to establish a baseline. Apply the single-run, 2₂ₛ, R₄ₛ and fail-count rules first. Allowable error (% degradation) is separate: it governs tolerable change, not daily QC limits.";

  return { rules, phaseInNote };
}

// ─── AI-specific additions (Commons review, Oct 2026) ────────────────────────

function buildControlMaterial(tierProfile) {
  return {
    rationale: [
      "Daily QC runs on known-answer control tasks, the same way a lab runs control material. It does not wait for production outcomes, which often arrive late or never.",
      "Control tasks are built under the approved on-site validation plan, drawn from local cases with verified answers, and run on a fixed schedule.",
      "Production outcomes feed periodic evaluation and lookback, not the daily rules.",
      tierProfile.generative
        ? "For generative or agentic outputs, each control result is a graded score from a validated grader (see AI-specific validation additions)."
        : "Each control result is the model's output on a case whose true answer is known.",
    ],
  };
}

// Simulates how often the rule set fires with no error (false rejection) and how often
// it catches a 1 SD and 2 SD shift within a 10-run window. Same rules as above.
function simulateRuleSetPerformance() {
  const W = 10, N = 4000;
  const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const fires = (zs) => {
    for (let i = 0; i < zs.length; i++) {
      const z = zs[i], p = i ? zs[i - 1] : null;
      if (Math.abs(z) > 3) return true;
      if (p !== null && ((z > 2 && p > 2) || (z < -2 && p < -2))) return true;
      if (p !== null && Math.abs(z - p) > 4 && z * p < 0) return true;
      if (i >= 9) { const w = zs.slice(i - 9, i + 1); if (w.every((x) => x > 0) || w.every((x) => x < 0)) return true; }
    }
    return false;
  };
  const rate = (shift) => { let k = 0; for (let t = 0; t < N; t++) { if (fires(Array.from({ length: W }, () => gauss() + shift))) k++; } return k / N; };
  const pfr = rate(0), ped1 = rate(1), ped2 = rate(2);
  const p = (x) => `${(x * 100).toFixed(1)}%`;
  return {
    rationale: [
      `With no error present, the reject rules fire in about ${p(pfr)} of 10-run windows (false rejection).`,
      `A 1 SD shift is caught within 10 runs about ${p(ped1)} of the time; a 2 SD shift about ${p(ped2)}.`,
      "These are the monitor's own sensitivity and specificity, separate from the model's. Its PPV depends on how often real errors occur: when they are rare, most rejects are false alarms.",
      "Tuning the rule set trades systematic-error detection against random-error detection. Any change to the rule set is a locked-parameter change: logged old → new, re-signed by the independent authority, and the affected controls re-baselined.",
    ],
  };
}

function buildPrevalenceMonitoring(metrics) {
  return {
    rationale: [
      "Track local prevalence and the model's positive-call rate as monitored metrics in their own right.",
      "PPV and NPV move when prevalence moves, even if the model has not changed. Without this, a prevalence shift reads as model drift.",
      metrics.calculable
        ? `Validated PPV ${metrics.ppvDisplay} and NPV ${metrics.npvDisplay} hold only at the prevalence entered; recompute when prevalence changes.`
        : "PPV and NPV were not calculable; record prevalence before deployment.",
    ],
  };
}

function buildChangeControl(tierProfile) {
  const high = tierProfile.riskClass === "high";
  return {
    rationale: [
      "Change control is risk-based and decided in advance, by the system's classification and the type of change (like FDA change control plans and IQCP). Three tiers, used precisely, so routine changes stay proportionate and full revalidation stays rare.",
      "Re-baseline: a new or replaced control item, or a new lot of control material. Establish a new mean and SD for that control only, run alongside the current material; each control has its own chart, so the others are unaffected. No performance claim is re-proven. Signed by the operator.",
      `Verification: the agent changed but its intended use did not (a vendor model version, or a prompt or configuration change within validated scope). Requires the control set and a sample of real tasks, judged against the existing acceptance limits with criteria set in advance; controls alone are only QC. The real-task sample is sized to what the decision needs${high ? " (larger for this high-risk use)" : ""}, not maximized. Pass: re-baseline and release. Fail: the change does not go live. Signed by the independent authority, because a model change is a locked-parameter change.`,
      "Revalidation: the claim changed (new intended use, population, data source or retrieval corpus, or a modification to how the agent works). Spec, acceptance limits, accuracy, precision, subgroup performance and validated range are set again under a new on-site plan. Signed by the independent authority and clinical leadership.",
      "Any change to locked validation parameters (limits, rule set, acceptable cutoffs) is logged old → new and re-signed by the independent authority.",
    ],
  };
}

// Response layer (Nov 12, Commons tool knob 4): what happens after a rule fires.
function buildResponseLayer(answers) {
  const authority = answers.Q33 ? `sign-off by ${answers.Q33} (the independent authority)` : "sign-off by the independent authority (not yet named; see gap flags)";
  return {
    rationale: [
      "Auto-release: results release without human review only when no rejection rule has fired, no warning is past its acknowledgment deadline, the model version is unchanged, and no locked parameter has changed. Acknowledged warnings do not block auto-release.",
      "First response to a rejection: hold, and route the agent's work to the human queue. One automatic rerun is allowed only when random error is suspected; repeated reruns until a run passes conceal real error. Alternatives: fail over to a backup that carries its own QC, or switch to the contingency procedure.",
      "Warnings: set an acknowledgment deadline at validation (starting value in the Commons Agent QC Setup: 1 business day). A warning not acknowledged in time holds the agent like a rejection, with a defined walk-back (escalate, then log).",
      "Human queue: owned by a named role, with a response time set at validation (starting value: the response time staff already meet for the same work; same shift if none is defined). If the owner does not respond in time, the item escalates to a named backup role, then to the independent authority. The same timer applies to every approval in this layer, so nothing waits on one person.",
      `Release authority: the operator may release after a first-line fix (non-analytic cause or clean correction, no failover, no locked parameter changed). Release requires ${authority} if the agent failed over, the cause was not found, a rerun failed, or a locked parameter changed during the hold. The person who loosened a limit does not also release under it.`,
      "Corrected outputs: decide at validation who is told when a released output is found wrong, and how (clinician, patient, chart correction). Fixing the agent does not fix outputs already acted on.",
      "Contingency: time on the manual procedure is monitored, with escalating reminders at intervals set at validation (starting value: 24 hours, 72 hours, 7 days), so contingency does not become the permanent workflow.",
      "A failure the QC missed triggers a QC design review, not an automatic new control: were the controls at the right decision points, and were the rules strong enough for the method's sigma? Move or replace a control before adding one. Size the set by decision points: one control near each boundary that matters, plus a few anchors and drift sensors. Each added control adds false alarms.",
      "Outward reporting: confirmed failures go to the vendor and the organization's safety event reporting; optionally to the Commons Peer Challenge Registry once registration reopens (it is browse-only while paused), until a standard registry exists.",
    ],
  };
}

function buildLookback(tierProfile, answers) {
  return {
    rationale: [
      "After a reject, re-review only outputs that could cause harm, defined at validation from intended use (worst-case severity and likelihood). Not everything.",
      "Lookback window: from the last acceptable QC run to the hold. If a backup or contingency carried the load, its output during the hold is a second lane.",
      tierProfile.falseNegBias || answers.q4_tradeoff === "Missing a true case is worse"
        ? "Misses are the higher-harm error here: prioritize negatives the model issued during the window."
        : "Prioritize the error type the risk assessment named as most harmful.",
      "If validation parameters changed during the hold, re-judge past results under the new settings.",
    ],
  };
}

function buildAiValidation(tierProfile) {
  const items = [
    "Repeat-run precision: the same inputs can give different outputs. Run a fixed case set several times and measure the spread, rather than inferring precision from one validation run.",
    "Baselines from thin data start provisional and are established with cumulative in-control runs; flagged runs never feed the baseline.",
  ];
  if (tierProfile.generative) {
    items.push(
      "Grader: define who or what scores each output (human reviewer or model grader) and treat it as an instrument with its own validation.",
      "Grader precision study: grade the same outputs repeatedly; size grades to at least 4 grader SDs so a grade means something.",
      "Acceptable cutoff: in the operating range, acceptable = pass. Set the cutoff grade by intended use and lock it with validation."
    );
  }
  return { rationale: items };
}

// ─── Population-stratified control limits ────────────────────────────────────

function buildStratifiedLimits(population, metrics, tierProfile) {
  // This is the Commons "bridge position" on fixed vs. adaptive thresholds:
  // Population-stratified control limits as the middle path.
  // Fixed thresholds ignore known performance differentials across subgroups.
  // Fully adaptive thresholds require data we don't always have.
  // Stratified limits acknowledge subgroups exist and flag where monitoring must be disaggregated.

  const stratifiedGroups = [];
  const rationale = [];
  const gaps = [];

  if (!population) {
    gaps.push("Target population not specified — stratified control limits cannot be generated. Monitoring will use aggregate thresholds only.");
    return { stratifiedGroups, rationale, gaps, note: "Population stratification requires Q8 answer." };
  }

  // Standard stratification axes for clinical AI
  const axes = [
    { axis: "Age", subgroups: ["Pediatric (<18)", "Adult (18–64)", "Geriatric (65+)"], priority: "high" },
    { axis: "Sex/Gender", subgroups: ["Male", "Female", "Non-binary/other"], priority: "high" },
    { axis: "Race/Ethnicity", subgroups: ["Based on local demographic mix"], priority: "high" },
    { axis: "Socioeconomic/Insurance status", subgroups: ["Based on payer mix"], priority: "moderate" },
    { axis: "Language", subgroups: ["English", "Non-English primary"], priority: "moderate" },
    { axis: "Comorbidity burden", subgroups: ["Low", "Moderate", "High"], priority: "moderate" },
  ];

  for (const ax of axes) {
    stratifiedGroups.push({
      axis: ax.axis,
      subgroups: ax.subgroups,
      monitoringRecommendation: ax.priority === "high"
        ? `Disaggregate monitoring metrics by ${ax.axis}. Flag a subgroup for review when its error rate is at least 1.5 times the aggregate error rate (ratio set at validation; 1.5 is the starting value in the Commons Agent QC Setup) and the lower bound of its 95% interval is above the aggregate rate, confirmed on the next review window. A gap that meets the ratio but not the interval is watched, not acted on.`
        : `Monitor ${ax.axis} subgroups quarterly or when aggregate threshold crossings occur.`,
      dataRequirement: `Local EHR stratification by ${ax.axis} required. If unavailable, flag as monitoring gap.`,
      priority: ax.priority,
    });
  }

  rationale.push(
    "Subgroup flags need a minimum number of cases per subgroup per window before they count; small subgroups are noisy.",
    "Checking many subgroups at once guarantees some false flags by chance. Adjust for the number of comparisons, or confirm a flag on the next window before acting.",
    "Population-stratified control limits serve as the middle path between fixed and adaptive thresholds.",
    "Fixed aggregate thresholds can mask subgroup-specific performance degradation that does not surface until harm occurs.",
    "Fully adaptive thresholds require longitudinal data that is often unavailable at deployment.",
    "Stratified monitoring allows aggregate thresholds to govern overall stop/action decisions while disaggregated tracking provides early warning of differential performance.",
    "Whoever reviews subgroup performance data owns the governance decision about whether differential performance is acceptable — this is not a technical question."
  );

  if (!metrics.calculable) {
    gaps.push("PPV/NPV not calculable — stratified performance differences cannot be expressed in predictive value terms. Use sensitivity/specificity differentials as proxy.");
  }

  return { stratifiedGroups, rationale, gaps };
}

// ─── Ownership statement ─────────────────────────────────────────────────────

function buildOwnershipStatement(corrActOwner, useType) {
  const defaultOwner = "designated clinical governance lead (role not yet assigned — see gap flags)";
  const owner = corrActOwner || defaultOwner;

  const highRiskUseTypes = ["diagnostic_primary", "treatment_recommendation", "triage_prioritization", "risk_stratification"];
  const isHighRisk = highRiskUseTypes.includes(useType);

  return {
    owner,
    statement: `The individual who signs the corrective action plan for this deployment is ${owner}. This is a governance decision, not a technical one. Threshold values in this tier framework are recommendations — the authority to accept, modify, or reject them rests with ${owner}.`,
    escalationPath: isHighRisk
      ? `For high-risk use types, corrective actions require co-signature from a clinical governance authority (e.g., CMO, patient safety officer, or equivalent). Single-role sign-off is insufficient.`
      : `For this use type, corrective actions may be signed by the operational governance owner with documentation of clinical review.`,
    principleStatement: "Whoever signs the corrective action owns the governance decision. Threshold values are inputs to that decision, not substitutes for it.",
  };
}

function runBiasCrossref({ answers, logicFlags, gapFlags, isFullProtocol }) {
  if (isFullProtocol) {
    return buildFullBiasAssessment({ answers, logicFlags, gapFlags });
  } else {
    return buildQualitativeBiasAssessment({ answers, logicFlags, gapFlags });
  }
}

// ─── Full mode: mapping function + color-coded table ─────────────────────────

function buildFullBiasAssessment({ answers, logicFlags, gapFlags }) {
  // S2 answers: vendor demographic categories + local recording methodology
  const vendorDemographics = parseVendorDemographics(answers);
  const localMethodology = parseLocalMethodology(answers);
  const modelCardAvailable = answers.Q_modelcard === "yes" || answers.Q19 === "yes";
  const vendorNonDisclosure = answers.Q_vendor_disclosure === "no" || answers.Q20 === "no";

  // Run mapping function across each demographic axis
  const mappingResults = runMappingFunction(vendorDemographics, localMethodology);

  // Build compatibility table (color-coded: compatible / partial / incompatible / unknown)
  const compatibilityTable = buildCompatibilityTable(mappingResults);

  // Numerical mismatch flags
  const mismatchFlags = extractMismatchFlags(mappingResults);

  // Unaddressed risks
  const unaddressedRisks = identifyUnaddressedRisks(mappingResults, vendorNonDisclosure, answers);

  // Section-level gaps
  const biasGapFlags = buildBiasGapFlags(vendorDemographics, localMethodology, modelCardAvailable, vendorNonDisclosure, gapFlags);

  return {
    section: "bias_assessment",
    mode: "full",
    modelCardAvailable,
    vendorNonDisclosure,
    vendorDemographics,
    localMethodology,
    mappingResults,
    compatibilityTable,
    mismatchFlags,
    unaddressedRisks,
    biasGapFlags,
    principleStatement: "Bias assessment is required regardless of model card availability or vendor disclosure posture. Absence of data is itself a finding.",
    generatedAt: new Date().toISOString(),
  };
}

// ─── Qualitative mode: narrative + risk naming ────────────────────────────────

function buildQualitativeBiasAssessment({ answers, logicFlags, gapFlags }) {
  const vendorDemographics = parseVendorDemographics(answers);
  const localMethodology = parseLocalMethodology(answers);
  const vendorNonDisclosure = answers.Q_vendor_disclosure === "no" || answers.Q20 === "no";

  // Qualitative mismatch summary — narrative, no mapping function
  const narrativeSummary = buildNarrativeSummary(vendorDemographics, localMethodology);

  // Named risks even without quantification
  const namedRisks = nameUnquantifiedRisks(vendorDemographics, localMethodology, vendorNonDisclosure, answers);

  const biasGapFlags = buildBiasGapFlags(vendorDemographics, localMethodology, false, vendorNonDisclosure, gapFlags);

  // Note: qualitative mode still flags mismatches — it just doesn't produce a mapping function
  const mismatchFlags = narrativeMismatchFlags(vendorDemographics, localMethodology);

  return {
    section: "bias_assessment",
    mode: "qualitative",
    vendorNonDisclosure,
    vendorDemographics,
    localMethodology,
    narrativeSummary,
    namedRisks,
    mismatchFlags,
    biasGapFlags,
    principleStatement: "Workflow summary mode produces a qualitative bias assessment. Mismatches are named and flagged. Quantitative mapping requires full validation protocol.",
    generatedAt: new Date().toISOString(),
  };
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

// Standard demographic axes tracked across both vendor and local sides
const DEMOGRAPHIC_AXES = [
  { id: "race_ethnicity", label: "Race / Ethnicity", riskWeight: "high" },
  { id: "sex_gender", label: "Sex / Gender", riskWeight: "high" },
  { id: "age", label: "Age", riskWeight: "high" },
  { id: "socioeconomic", label: "Socioeconomic Status / Insurance", riskWeight: "high" },
  { id: "language", label: "Language / English Proficiency", riskWeight: "moderate" },
  { id: "geography", label: "Geographic Origin (training data region)", riskWeight: "moderate" },
  { id: "comorbidity", label: "Comorbidity Profile", riskWeight: "moderate" },
  { id: "disability", label: "Disability Status", riskWeight: "moderate" },
  { id: "bmi", label: "BMI / Body Habitus", riskWeight: "low" },
  { id: "social_determinants", label: "Social Determinants of Health (SDOH)", riskWeight: "high" },
];

function parseVendorDemographics(answers) {
  // Q_vendor_demographics or S2 answers map to vendor model card reported categories
  // Expected: array of axis IDs that vendor reported, or "not_disclosed"
  const raw = answers.Q_vendor_demographics || answers.Q21 || null;
  // Not recorded: the question (q_vendor_demo, added Nov 13, 2026) was left blank or
  // answered "Not asked yet". Say so, rather than recording the vendor as a non-discloser.
  if (raw === null || raw === undefined) {
    return {
      reported: [],
      notDisclosed: true,
      notAsked: true,
      note: "Not recorded: what the vendor disclosed about the patients in its training data. Ask the vendor, and put it in the contract.",
    };
  }
  if (raw === "not_disclosed" || raw === "") {
    return {
      reported: [],
      notDisclosed: true,
      note: "Vendor did not provide demographic breakdown of training data. This is a finding, not a data gap.",
    };
  }

  const reported = Array.isArray(raw) ? raw : raw.split(",").map((s) => s.trim());
  return {
    reported,
    notDisclosed: false,
    note: null,
  };
}

function parseLocalMethodology(answers) {
  // Q_local_recording or S2 answers for how local site records demographic data
  const raw = answers.Q_local_recording || answers.Q22 || null;
  const inconsistencies = answers.Q_recording_inconsistencies || answers.Q23 || null;

  if (!raw) {
    return {
      recorded: [],
      inconsistencies: [],
      unknown: true,
      note: "Local recording methodology not documented. Cannot assess compatibility with vendor training data.",
    };
  }

  const recorded = Array.isArray(raw) ? raw : raw.split(",").map((s) => s.trim());
  const inconsistencyList = inconsistencies
    ? (Array.isArray(inconsistencies) ? inconsistencies : inconsistencies.split(",").map((s) => s.trim()))
    : [];

  return {
    recorded,
    inconsistencies: inconsistencyList,
    unknown: false,
    note: inconsistencyList.length > 0 ? "Recording inconsistencies documented — compatibility assessment will reflect known gaps." : null,
  };
}

// ─── Mapping function (full mode only) ───────────────────────────────────────

function runMappingFunction(vendorDemographics, localMethodology) {
  return DEMOGRAPHIC_AXES.map((axis) => {
    const vendorReported = !vendorDemographics.notDisclosed && vendorDemographics.reported.includes(axis.id);
    const localRecorded = !localMethodology.unknown && localMethodology.recorded.includes(axis.id);
    const localInconsistent = localMethodology.inconsistencies.includes(axis.id);

    let compatibility;
    let numericalMismatchRisk;
    let recommendedAction;

    if (vendorDemographics.notDisclosed && localMethodology.unknown) {
      compatibility = "unknown";
      numericalMismatchRisk = "unquantifiable";
      recommendedAction = "Require vendor disclosure as a contract condition or procurement prerequisite. Document absence as finding.";
    } else if (vendorDemographics.notDisclosed) {
      compatibility = "unknown";
      numericalMismatchRisk = axis.riskWeight === "high" ? "high" : "moderate";
      const localPart = localRecorded ? "Your site records this axis." : "Your site's recording of this axis was not documented.";
      recommendedAction = vendorDemographics.notAsked
        ? `What the vendor disclosed about ${axis.label} isn't recorded yet, so compatibility can't be assessed. ${localPart} Ask the vendor; until then treat it as a possible mismatch.`
        : `Vendor non-disclosure on ${axis.label}, so compatibility can't be assessed. ${localPart} Treat it as a possible mismatch until the vendor discloses.`;
    } else if (!vendorReported && !localRecorded) {
      compatibility = "not_tracked";
      numericalMismatchRisk = "unquantifiable";
      recommendedAction = `Neither vendor nor local site tracks ${axis.label}. Consider whether this axis is relevant to the clinical population — absence of tracking does not mean absence of differential performance.`;
    } else if (vendorReported && localRecorded && !localInconsistent) {
      compatibility = "compatible";
      numericalMismatchRisk = "low";
      recommendedAction = `Both vendor and local site track ${axis.label} consistently. Monitor for distributional shift between training population and local population.`;
    } else if (vendorReported && localRecorded && localInconsistent) {
      compatibility = "partial";
      numericalMismatchRisk = axis.riskWeight === "high" ? "high" : "moderate";
      recommendedAction = `${axis.label} tracked by both parties but local recording is inconsistent. Inconsistent local recording means model behavior cannot be reliably audited for this axis.`;
    } else if (vendorReported && !localRecorded) {
      compatibility = "partial";
      numericalMismatchRisk = "moderate";
      recommendedAction = `Vendor tracks ${axis.label} but local site does not record it. Subgroup performance cannot be monitored locally. Recommend adding to local data collection.`;
    } else if (!vendorReported && localRecorded) {
      compatibility = "incompatible";
      numericalMismatchRisk = axis.riskWeight === "high" ? "high" : "moderate";
      recommendedAction = `Local site records ${axis.label} but vendor did not train on it or did not disclose training representation. Model performance on local ${axis.label} distribution is unknown.`;
    } else {
      compatibility = "unknown";
      numericalMismatchRisk = "unquantifiable";
      recommendedAction = "Insufficient data to assess compatibility.";
    }

    return {
      axisId: axis.id,
      axisLabel: axis.label,
      riskWeight: axis.riskWeight,
      vendorReported,
      localRecorded,
      localInconsistent,
      compatibility,
      numericalMismatchRisk,
      recommendedAction,
    };
  });
}

// ─── Compatibility table builder ─────────────────────────────────────────────

// Color coding: compatible = green, partial = yellow, incompatible = red, unknown/not_tracked = gray
const COMPATIBILITY_COLORS = {
  compatible: { label: "Compatible", color: "#2d6a4f", bgColor: "#d8f3dc", textColor: "#1b4332" },
  partial: { label: "Partial / Inconsistent", color: "#d4a017", bgColor: "#fff3cd", textColor: "#856404" },
  incompatible: { label: "Incompatible", color: "#c0392b", bgColor: "#fde8e8", textColor: "#7b1818" },
  unknown: { label: "Unknown", color: "#6c757d", bgColor: "#f2f2f2", textColor: "#495057" },
  not_tracked: { label: "Not Tracked by Either Party", color: "#adb5bd", bgColor: "#f8f9fa", textColor: "#6c757d" },
};

function buildCompatibilityTable(mappingResults) {
  return {
    columns: ["Demographic Axis", "Risk Weight", "Vendor Reported", "Local Recorded", "Compatibility", "Mismatch Risk", "Recommended Action"],
    rows: mappingResults.map((r) => ({
      axis: r.axisLabel,
      riskWeight: r.riskWeight,
      vendorReported: r.vendorReported ? "Yes" : r.axisId && !r.vendorReported ? "No / Not Disclosed" : "—",
      localRecorded: r.localRecorded ? "Yes" : "No",
      compatibility: r.compatibility,
      compatibilityDisplay: COMPATIBILITY_COLORS[r.compatibility] || COMPATIBILITY_COLORS.unknown,
      mismatchRisk: r.numericalMismatchRisk,
      recommendedAction: r.recommendedAction,
    })),
    summary: buildTableSummary(mappingResults),
  };
}

function buildTableSummary(mappingResults) {
  const counts = { compatible: 0, partial: 0, incompatible: 0, unknown: 0, not_tracked: 0 };
  for (const r of mappingResults) {
    counts[r.compatibility] = (counts[r.compatibility] || 0) + 1;
  }

  const highRiskIncompatible = mappingResults.filter(
    (r) => r.riskWeight === "high" && (r.compatibility === "incompatible" || r.compatibility === "unknown")
  );

  return {
    counts,
    highRiskIncompatibleCount: highRiskIncompatible.length,
    highRiskIncompatibleAxes: highRiskIncompatible.map((r) => r.axisLabel),
    overallRating:
      highRiskIncompatible.length >= 3
        ? "critical"
        : highRiskIncompatible.length >= 1
        ? "elevated"
        : counts.partial > 2
        ? "moderate"
        : "adequate",
  };
}

// ─── Mismatch flags (full mode) ───────────────────────────────────────────────

function extractMismatchFlags(mappingResults) {
  return mappingResults
    .filter((r) => r.numericalMismatchRisk === "high" || r.compatibility === "incompatible")
    .map((r) => ({
      axis: r.axisLabel,
      risk: r.numericalMismatchRisk,
      compatibility: r.compatibility,
      flag: `${r.axisLabel}: ${r.compatibility === "incompatible" ? "Incompatible recording methodology" : "High mismatch risk"} — ${r.recommendedAction}`,
    }));
}

// ─── Unaddressed risks ────────────────────────────────────────────────────────

function identifyUnaddressedRisks(mappingResults, vendorNonDisclosure, answers) {
  const risks = [];

  if (vendorNonDisclosure) {
    risks.push({
      risk: "Vendor non-disclosure",
      severity: "high",
      description:
        "Vendor has not disclosed training data demographic composition. Compatibility cannot be assessed for any axis where vendor did not voluntarily disclose. Non-disclosure is a governance finding, not a neutral data state.",
      mitigationOptions: [
        "Require disclosure as a contract condition at next renewal.",
        "Request FDA 510(k) or CE mark submission documentation if applicable.",
        "Escalate to procurement/legal if vendor declines disclosure.",
        "Treat all vendor-unreported axes as incompatible for governance purposes until disclosure is obtained.",
      ],
    });
  }

  const untracked = mappingResults.filter((r) => r.compatibility === "not_tracked" && r.riskWeight !== "low");
  if (untracked.length > 0) {
    risks.push({
      risk: "Untracked demographic axes",
      severity: "moderate",
      description: `${untracked.length} demographic axes (${untracked.map((r) => r.axisLabel).join(", ")}) are not tracked by either vendor or local site. Absence of tracking does not mean absence of differential performance — it means differential performance cannot be detected.`,
      mitigationOptions: [
        "Review clinical significance of each untracked axis for this use type.",
        "Add higher-risk axes to local data collection plan.",
        "Document governance decision to accept untracked status for lower-risk axes.",
      ],
    });
  }

  // SDOH is almost always under-represented and high risk
  const sdohResult = mappingResults.find((r) => r.axisId === "social_determinants");
  if (sdohResult && sdohResult.compatibility !== "compatible") {
    risks.push({
      risk: "Social Determinants of Health (SDOH) gap",
      severity: "high",
      description:
        "SDOH factors are systematically underrepresented in most ML training datasets and are inconsistently recorded in EHR systems. Models trained without SDOH representation may perform worse for high-SDOH-burden patients — who are often the highest-need patients in safety-net settings.",
      mitigationOptions: [
        "Flag SDOH gap in monitoring plan.",
        "Stratify performance review by payer mix or neighborhood deprivation index as SDOH proxy.",
        "Engage equity/diversity team to review SDOH risk for this deployment.",
      ],
    });
  }

  return risks;
}

// ─── Qualitative mode helpers ─────────────────────────────────────────────────

function buildNarrativeSummary(vendorDemographics, localMethodology) {
  const parts = [];

  if (vendorDemographics.notDisclosed) {
    parts.push(
      "The vendor has not disclosed the demographic composition of the training dataset. This prevents any assessment of how well the training population matches the local patient population. Vendor non-disclosure is documented as a governance finding."
    );
  } else if (vendorDemographics.reported.length > 0) {
    parts.push(
      `The vendor reported training data representation for the following demographic categories: ${vendorDemographics.reported.join(", ")}. This does not confirm adequate representation — only that the vendor tracked these categories.`
    );
  }

  if (localMethodology.unknown) {
    parts.push(
      "Local recording methodology for demographic data has not been documented. Without this information, it is not possible to assess whether local patient population demographics are compatible with the training data distribution."
    );
  } else if (localMethodology.recorded.length > 0) {
    parts.push(
      `Local site records the following demographic categories: ${localMethodology.recorded.join(", ")}.`
    );
    if (localMethodology.inconsistencies.length > 0) {
      parts.push(
        `Known recording inconsistencies have been identified for: ${localMethodology.inconsistencies.join(", ")}. These inconsistencies limit the ability to monitor model performance for affected subgroups.`
      );
    }
  }

  return parts.join(" ");
}

function nameUnquantifiedRisks(vendorDemographics, localMethodology, vendorNonDisclosure, answers) {
  const risks = [];

  if (vendorNonDisclosure) {
    risks.push("Vendor non-disclosure: training data demographics not available for review.");
  }
  if (localMethodology.unknown) {
    risks.push("Local recording methodology undocumented: subgroup monitoring not possible.");
  }
  if (localMethodology.inconsistencies.length > 0) {
    risks.push(`Inconsistent local recording for: ${localMethodology.inconsistencies.join(", ")}.`);
  }

  // Check for high-risk population signals in answers
  const isSafetyNet = answers.Q9 === "safety_net" || answers.Q_setting === "safety_net";
  if (isSafetyNet) {
    risks.push(
      "Safety-net setting: higher SDOH burden, payer mix variation, and language diversity increase bias risk. Standard bias assessments designed for academic medical centers may underperform for this population."
    );
  }

  return risks;
}

function narrativeMismatchFlags(vendorDemographics, localMethodology) {
  const flags = [];

  for (const axis of DEMOGRAPHIC_AXES) {
    const vendorReported = !vendorDemographics.notDisclosed && vendorDemographics.reported.includes(axis.id);
    const localRecorded = !localMethodology.unknown && localMethodology.recorded.includes(axis.id);

    if (!vendorReported && localRecorded && axis.riskWeight === "high") {
      flags.push(
        `${axis.label}: Local site records this but vendor did not disclose training representation. Performance differential on local ${axis.label} distribution is unknown.`
      );
    }
    if (vendorReported && !localRecorded && axis.riskWeight === "high") {
      flags.push(
        `${axis.label}: Vendor tracked this in training data but local site does not record it. Cannot monitor for subgroup performance differences.`
      );
    }
  }

  return flags;
}

// ─── Gap flags ────────────────────────────────────────────────────────────────

function buildBiasGapFlags(vendorDemographics, localMethodology, modelCardAvailable, vendorNonDisclosure, existingGapFlags) {
  const flags = [];

  if (vendorDemographics.notAsked) {
    flags.push("VENDOR_DEMOGRAPHICS_NOT_RECORDED: What the vendor disclosed about the patients in its training data isn't recorded (Section 1), so the compatibility table can't be completed. Get it from the vendor (model card or contract).");
  }
  if (vendorNonDisclosure) {
    flags.push("VENDOR_NON_DISCLOSURE: Vendor has not provided demographic breakdown of training data. Compatibility assessment is incomplete.");
  }
  if (localMethodology.unknown) {
    flags.push("LOCAL_METHODOLOGY_UNKNOWN: Local demographic recording methodology not documented. Subgroup performance monitoring is not possible until this is resolved.");
  }
  if (!modelCardAvailable) {
    flags.push("NO_MODEL_CARD: No model card or equivalent disclosure. Since HTI-5 (effective Dec 28, 2026) certified EHRs no longer have to provide one, so ask for it in the contract: intended use, training data and its demographics, validation results with sample sizes, known limits, and notice before model updates. Until then, bias assessment rests on the vendor's word and your own local numbers.");
  }
  if (localMethodology.inconsistencies.length > 0) {
    flags.push(`RECORDING_INCONSISTENCIES: ${localMethodology.inconsistencies.join(", ")} have known recording inconsistencies that limit audit reliability.`);
  }

  return flags;
}

const COMMONS_NODES = [
  {
    id: "watcher",
    label: "Watcher",
    description: "Ongoing performance monitoring and drift detection. Who watches the model after it goes live?",
    domain: "Monitoring & Surveillance",
    signalQuestions: ["Q28", "Q35", "Q36", "Q37"],
    riskSignals: {
      critical: ["no_monitoring_owner", "no_drift_criteria", "no_audit_schedule"],
      moderate: ["monitoring_informal", "drift_undefined_but_acknowledged", "audit_schedule_vague"],
      adequate: ["monitoring_owner_named", "drift_criteria_defined", "audit_schedule_set"],
    },
  },
  {
    id: "h1",
    label: "H1 — Initial Human Review",
    description: "The first human touchpoint after model output. Who reviews and what authority do they have?",
    domain: "Human Oversight — Tier 1",
    signalQuestions: ["Q26", "Q27", "Q28", "Q29"],
    riskSignals: {
      critical: ["no_human_review", "human_review_nominal_only", "reviewer_authority_undefined"],
      moderate: ["human_review_exists_but_undertrained", "reviewer_authority_partial"],
      adequate: ["human_review_defined", "reviewer_authority_clear", "reviewer_trained"],
    },
  },
  {
    id: "h2",
    label: "H2 — Escalation Review",
    description: "The escalation pathway when H1 cannot resolve. Who gets called and when?",
    domain: "Human Oversight — Tier 2",
    signalQuestions: ["Q29", "Q30", "Q31"],
    riskSignals: {
      critical: ["no_escalation_pathway", "escalation_ad_hoc"],
      moderate: ["escalation_pathway_exists_but_informal", "escalation_criteria_vague"],
      adequate: ["escalation_pathway_documented", "escalation_criteria_defined"],
    },
  },
  {
    id: "authority",
    label: "Authority",
    description: "Who has the power to make decisions, approve changes, and sign corrective actions?",
    domain: "Decision Authority & Accountability",
    signalQuestions: ["Q28", "Q32", "Q33"],
    riskSignals: {
      critical: ["authority_unassigned", "authority_diffuse_no_single_owner"],
      moderate: ["authority_assigned_informally", "corrective_action_owner_unclear"],
      adequate: ["authority_matrix_documented", "corrective_action_owner_named"],
    },
  },
  {
    id: "stop",
    label: "Stop",
    description: "When does the model pause or halt? Who pulls the plug and what triggers it?",
    domain: "Stop Mechanisms & Failover",
    signalQuestions: ["Q34", "Q36", "Q_stop_criteria"],
    riskSignals: {
      critical: ["no_stop_criteria", "no_failover_plan"],
      moderate: ["stop_criteria_vague", "failover_plan_incomplete"],
      adequate: ["stop_criteria_defined", "failover_plan_documented"],
    },
  },
  {
    id: "override",
    label: "Override",
    description: "Can clinicians override the model? Is override tracked? Does override data feed back into governance?",
    domain: "Override & Clinician Autonomy",
    signalQuestions: ["Q_override_possible", "Q_override_tracked", "Q_override_feedback"],
    riskSignals: {
      critical: ["override_not_possible", "override_exists_but_not_tracked"],
      moderate: ["override_tracked_but_not_analyzed", "override_friction_high"],
      adequate: ["override_enabled", "override_tracked_and_reviewed", "override_data_feeds_governance"],
    },
  },
  {
    id: "validation",
    label: "Validation",
    description: "How was the model validated? Was local validation performed? When does revalidation trigger?",
    domain: "Validation Framework",
    signalQuestions: ["Q10", "Q11", "Q12", "Q13", "Q14", "Q15", "Q16", "Q17"],
    riskSignals: {
      critical: ["vendor_validation_only", "no_local_validation", "no_revalidation_trigger"],
      moderate: ["local_validation_partial", "revalidation_criteria_informal"],
      adequate: ["local_validation_performed", "revalidation_triggers_defined"],
    },
  },
  {
    id: "norm",
    label: "Norm",
    description: "What norms govern use? Are there use policies, consent processes, staff training?",
    domain: "Norms, Policies & Consent",
    signalQuestions: ["Q38", "Q39", "Q40"],
    riskSignals: {
      critical: ["no_use_policy", "no_patient_consent_process", "no_staff_training"],
      moderate: ["use_policy_draft", "consent_informal", "training_ad_hoc"],
      adequate: ["use_policy_documented", "consent_process_defined", "staff_training_formalized"],
    },
  },
  {
    id: "h4",
    label: "H4 — Governance Review",
    description: "The organizational governance layer: committee, review board, or equivalent. Does it exist?",
    domain: "Organizational Governance",
    signalQuestions: ["Q32", "Q33", "Q_governance_body"],
    riskSignals: {
      critical: ["no_governance_body", "governance_body_nominal"],
      moderate: ["governance_body_exists_informal", "governance_body_infrequent"],
      adequate: ["governance_body_active", "governance_body_chartered"],
    },
  },
  {
    id: "commons",
    label: "Commons",
    description: "The shared governance infrastructure: cross-organizational learning, shared standards, community of practice.",
    domain: "Shared Governance Infrastructure",
    signalQuestions: ["Q_shared_learning", "Q_external_benchmarking"],
    riskSignals: {
      critical: ["no_shared_learning", "siloed_governance"],
      moderate: ["informal_peer_learning", "external_benchmarking_informal"],
      adequate: ["shared_learning_structured", "external_benchmarking_active"],
    },
  },
];

// ─── Main mapper ──────────────────────────────────────────────────────────────

function mapCommonsNodes({ answers, logicFlags, gapFlags }) {
  const useType = answers.Q2 || "unknown";
  const isHighRisk = logicFlags.includes("HIGH_AUTONOMY") || logicFlags.includes("DIRECT_CLINICAL_DECISION");
  const isSafetyNet = answers.Q9 === "safety_net" || answers.Q_setting === "safety_net";

  const nodeAssessments = COMMONS_NODES.map((node) =>
    assessNode(node, answers, logicFlags, isHighRisk, isSafetyNet)
  );

  const overallRating = deriveOverallRating(nodeAssessments);
  const priorityActions = derivePriorityActions(nodeAssessments, isHighRisk);
  const nodeGapFlags = deriveNodeGapFlags(nodeAssessments);

  // Cross-node dependency warnings
  const crossNodeWarnings = buildCrossNodeWarnings(nodeAssessments);

  return {
    section: "governance_node_assessment",
    useType,
    isHighRisk,
    isSafetyNet,
    nodeAssessments,
    overallRating,
    priorityActions,
    nodeGapFlags,
    crossNodeWarnings,
    taxonomyNote:
      "Node ratings reflect the governance posture of this specific deployment. They are not organizational ratings. A well-governed organization may have an inadequately governed deployment, and vice versa.",
    generatedAt: new Date().toISOString(),
  };
}

// ─── Node assessor ────────────────────────────────────────────────────────────

function assessNode(node, answers, logicFlags, isHighRisk, isSafetyNet) {
  const signals = extractSignals(node, answers);
  const rating = deriveNodeRating(node, signals, answers, logicFlags, isHighRisk);
  const gaps = extractNodeGaps(node, signals, answers);
  const recommendations = buildNodeRecommendations(node, rating, signals, isHighRisk, isSafetyNet);
  const unknownCount = signals.filter((s) => s.value === null || s.value === "unknown").length;
  const unknownIsSignal = unknownCount >= 2; // Multiple unknowns on a node = governance gap

  return {
    nodeId: node.id,
    nodeLabel: node.label,
    description: node.description,
    domain: node.domain,
    rating,
    ratingLabel: RATING_LABELS[rating],
    signals,
    unknownCount,
    unknownIsSignal,
    gaps,
    recommendations,
    priorityOrder: PRIORITY_ORDER[rating] + (isHighRisk ? -1 : 0), // High-risk deployments escalate priority
  };
}

const RATING_LABELS = {
  critical: { label: "Critical Gap", color: "#c0392b", bgColor: "#fde8e8", icon: "⚠" },
  moderate: { label: "Moderate Gap", color: "#d4a017", bgColor: "#fff3cd", icon: "◈" },
  adequate: { label: "Adequate", color: "#2d6a4f", bgColor: "#d8f3dc", icon: "✓" },
  unknown: { label: "Unknown — Requires Input", color: "#6c757d", bgColor: "#f2f2f2", icon: "?" },
};

const PRIORITY_ORDER = { critical: 1, unknown: 2, moderate: 3, adequate: 4 };

// ─── Signal extraction ────────────────────────────────────────────────────────

function extractSignals(node, answers) {
  return node.signalQuestions.map((qId) => ({
    questionId: qId,
    value: answers[qId] || null,
    present: !!answers[qId],
  }));
}

// ─── Node rating logic ────────────────────────────────────────────────────────
// Each node has custom logic based on its domain and which answers are most critical.

function deriveNodeRating(node, signals, answers, logicFlags, isHighRisk) {
  switch (node.id) {
    case "watcher":
      return rateWatcher(answers, isHighRisk);
    case "h1":
      return rateH1(answers, isHighRisk);
    case "h2":
      return rateH2(answers, isHighRisk);
    case "authority":
      return rateAuthority(answers, isHighRisk);
    case "stop":
      return rateStop(answers, isHighRisk);
    case "override":
      return rateOverride(answers, isHighRisk);
    case "validation":
      return rateValidation(answers, isHighRisk);
    case "norm":
      return rateNorm(answers, isHighRisk);
    case "h4":
      return rateH4(answers);
    case "commons":
      return rateCommons(answers);
    default:
      return "unknown";
  }
}

function rateWatcher(a, isHighRisk) {
  const hasOwner = !!a.Q28;
  const hasDrift = a.Q36 === "yes";
  const hasSchedule = a.Q37 === "yes" || !!a.Q37;
  const hasAuditData = a.Q35 === "yes";
  if (!hasOwner && !hasDrift) return "critical";
  if (!hasOwner || !hasDrift) return isHighRisk ? "critical" : "moderate";
  if (!hasSchedule && isHighRisk) return "moderate";
  return "adequate";
}

function rateH1(a, isHighRisk) {
  const hasHumanReview = a.Q26 !== "no" && a.Q26 !== undefined;
  const reviewerDefined = !!a.Q27;
  const reviewerAuthority = !!a.Q_reviewer_authority || !!a.Q29;
  if (!hasHumanReview && isHighRisk) return "critical";
  if (!reviewerDefined) return isHighRisk ? "critical" : "moderate";
  if (!reviewerAuthority) return "moderate";
  return "adequate";
}

function rateH2(a, isHighRisk) {
  const hasEscalation = a.Q29 !== "no" && !!a.Q29;
  const escalationDefined = !!a.Q30;
  if (!hasEscalation && isHighRisk) return "critical";
  if (!hasEscalation) return "moderate";
  if (!escalationDefined) return "moderate";
  return "adequate";
}

function rateAuthority(a, isHighRisk) {
  const corrActOwner = !!a.Q28;
  const authorityMatrix = !!a.Q32 || !!a.Q33;
  if (!corrActOwner && isHighRisk) return "critical";
  if (!corrActOwner) return "moderate";
  if (!authorityMatrix && isHighRisk) return "moderate";
  return "adequate";
}

function rateStop(a, isHighRisk) {
  const stopCriteria = !!a.Q34 || !!a.Q_stop_criteria;
  const driftDefined = a.Q36 === "yes";
  const failover = !!a.Q_failover;
  if (!stopCriteria && isHighRisk) return "critical";
  if (!stopCriteria) return "moderate";
  if (!failover && isHighRisk) return "moderate";
  return "adequate";
}

function rateOverride(a, isHighRisk) {
  const overridePossible = a.Q_override_possible !== "no";
  const overrideTracked = a.Q_override_tracked === "yes";
  const overrideFeedback = a.Q_override_feedback === "yes";
  if (!overridePossible && isHighRisk) return "critical";
  if (!overrideTracked) return isHighRisk ? "critical" : "moderate";
  if (!overrideFeedback) return "moderate";
  return "adequate";
}

function rateValidation(a, isHighRisk) {
  const localValidation = a.Q12 === "yes" || a.Q_local_validation === "yes";
  const performanceMetrics = !!a.Q15 || !!a.Q16;
  const revalidationTrigger = !!a.Q_revalidation_trigger;
  if (!localValidation && isHighRisk) return "critical";
  if (!localValidation) return "moderate";
  if (!performanceMetrics) return "moderate";
  if (!revalidationTrigger && isHighRisk) return "moderate";
  return "adequate";
}

function rateNorm(a, isHighRisk) {
  const usePolicy = !!a.Q38 || a.Q_use_policy === "yes";
  const staffTraining = !!a.Q39 || a.Q_staff_training === "yes";
  const patientConsent = !!a.Q40 || a.Q_consent === "yes";
  if (!usePolicy && isHighRisk) return "critical";
  if (!usePolicy) return "moderate";
  if (!staffTraining) return "moderate";
  if (!patientConsent && isHighRisk) return "moderate";
  return "adequate";
}

function rateH4(a) {
  const govBody = !!a.Q32 || !!a.Q_governance_body;
  const govBodyActive = a.Q_governance_body_active === "yes";
  if (!govBody) return "critical";
  if (!govBodyActive) return "moderate";
  return "adequate";
}

function rateCommons(a) {
  const sharedLearning = a.Q_shared_learning === "yes";
  const externalBenchmark = a.Q_external_benchmarking === "yes";
  // Commons is the aspirational layer — missing is moderate, not critical, for single deployment
  if (!sharedLearning && !externalBenchmark) return "moderate";
  if (!sharedLearning || !externalBenchmark) return "moderate";
  return "adequate";
}

// ─── Gap and recommendation builders ─────────────────────────────────────────

function extractNodeGaps(node, signals, answers) {
  const unanswered = signals.filter((s) => !s.present).map((s) => s.questionId);
  return unanswered.length > 0
    ? [`${unanswered.length} signal question(s) unanswered for this node: ${unanswered.join(", ")}`]
    : [];
}

const NODE_RECOMMENDATIONS = {
  watcher: {
    critical: [
      "Assign a named monitoring owner before deployment proceeds.",
      "Define minimum monitoring cadence (at minimum monthly for high-risk use types).",
      "Establish pre-specified drift criteria using validation baseline metrics.",
    ],
    moderate: [
      "Formalize monitoring schedule in writing.",
      "Ensure monitoring owner has authority to act on findings — not just observe.",
    ],
    adequate: [
      "Review monitoring criteria at each scheduled audit.",
      "Confirm monitoring owner is still current after any personnel changes.",
    ],
  },
  h1: {
    critical: [
      "Define human review requirement before go-live. For high-risk use types, human review is not optional.",
      "Name the reviewer role and specify what authority that role has to act on model output.",
    ],
    moderate: [
      "Formalize reviewer training requirements.",
      "Clarify whether reviewer can override, defer, or must escalate.",
    ],
    adequate: ["Maintain reviewer training records.", "Review reviewer authority matrix at each governance cycle."],
  },
  h2: {
    critical: [
      "Document escalation pathway. Who does H1 call when they can't resolve?",
      "Define escalation criteria — what triggers escalation vs. H1 autonomous resolution?",
    ],
    moderate: ["Convert informal escalation pathway to documented protocol.", "Test escalation pathway in tabletop exercise."],
    adequate: ["Review escalation criteria annually.", "Confirm escalation contacts are current."],
  },
  authority: {
    critical: [
      "Assign a single named corrective action owner before deployment.",
      "Diffuse authority is no authority — someone must be accountable.",
    ],
    moderate: ["Formalize authority assignment in governance documentation.", "Clarify co-signature requirements for high-risk decisions."],
    adequate: ["Review authority matrix after any personnel or organizational changes."],
  },
  stop: {
    critical: [
      "Define stop criteria before deployment. What will cause this model to be paused or shut down?",
      "Document failover plan. What happens to the clinical workflow when the model is unavailable?",
    ],
    moderate: [
      "Tighten vague stop criteria into pre-specified thresholds.",
      "Test failover plan in simulation.",
    ],
    adequate: ["Review stop criteria at each monitoring cycle.", "Update failover plan if clinical workflow changes."],
  },
  override: {
    critical: [
      "Ensure clinician override is possible. Removing override capability is not a governance posture — it is a liability.",
      "Implement override tracking before go-live.",
    ],
    moderate: [
      "Establish override review process — tracked data must be analyzed to be useful.",
      "Review override friction — high friction suppresses override, distorting governance signal.",
    ],
    adequate: [
      "Use override data as a governance input at each review cycle.",
      "Distinguish between overrides that indicate model error vs. clinical preference.",
    ],
  },
  validation: {
    critical: [
      "Perform local validation before deployment. Vendor validation on vendor data is not sufficient.",
      "Define revalidation triggers before go-live.",
    ],
    moderate: ["Complete partial local validation.", "Formalize revalidation criteria in writing."],
    adequate: ["Review validation documentation at each governance cycle.", "Update revalidation triggers if use context changes."],
  },
  norm: {
    critical: [
      "Develop use policy before deployment.",
      "Define staff training requirements.",
      "Assess patient consent obligations for this use type.",
    ],
    moderate: ["Finalize draft use policy.", "Formalize training from ad hoc to structured program."],
    adequate: ["Review use policy annually.", "Update training requirements when model or workflow changes."],
  },
  h4: {
    critical: [
      "Establish a governance body (committee, review board, or equivalent) with decision authority.",
      "Nominal governance — a body that meets but cannot act — does not satisfy this node.",
    ],
    moderate: ["Establish regular meeting cadence.", "Define governance body's decision authority in its charter."],
    adequate: ["Review governance body charter annually.", "Ensure governance body membership reflects clinical, operational, and patient perspectives."],
  },
  commons: {
    moderate: [
      "Identify peer institutions or professional networks for shared learning.",
      "Participate in external benchmarking or collaborative validation efforts.",
    ],
    adequate: [
      "Contribute learnings back to peer community.",
      "Review external benchmarks at each governance cycle.",
    ],
  },
};

function buildNodeRecommendations(node, rating, signals, isHighRisk, isSafetyNet) {
  const recs = NODE_RECOMMENDATIONS[node.id] || {};
  const baseRecs = recs[rating] || [];

  const additions = [];

  // Safety-net addendum
  if (isSafetyNet && (rating === "critical" || rating === "moderate")) {
    if (node.id === "norm") {
      additions.push("Safety-net context: Patient consent processes must account for language access needs and health literacy. Standard consent forms may not be sufficient.");
    }
    if (node.id === "validation") {
      additions.push("Safety-net context: Validate specifically on local population demographics. Academic medical center validation data may not generalize.");
    }
    if (node.id === "watcher") {
      additions.push("Safety-net context: Monitoring must include subgroup performance tracking. Aggregate performance metrics can mask differential harm in high-SDOH populations.");
    }
  }

  return [...baseRecs, ...additions];
}

// ─── Overall rating ───────────────────────────────────────────────────────────

function deriveOverallRating(nodeAssessments) {
  const criticalCount = nodeAssessments.filter((n) => n.rating === "critical").length;
  const unknownCount = nodeAssessments.filter((n) => n.unknownIsSignal).length;
  const highPriority = ["watcher", "authority", "stop", "validation"]; // Critical path nodes

  const criticalHighPriority = nodeAssessments.filter(
    (n) => n.rating === "critical" && highPriority.includes(n.nodeId)
  ).length;

  if (criticalHighPriority >= 2 || criticalCount >= 4) {
    return {
      rating: "critical",
      label: "Critical — Multiple Foundational Gaps",
      summary:
        "This deployment has critical gaps in foundational governance nodes. Deployment is not recommended until critical gaps are resolved. The protocol has identified specific required actions for each critical node.",
    };
  }
  if (criticalCount >= 1 || unknownCount >= 3) {
    return {
      rating: "elevated",
      label: "Elevated Risk — Targeted Remediation Required",
      summary:
        "This deployment has at least one critical governance gap or significant unknowns across multiple nodes. Deployment may proceed with a documented risk acceptance and remediation plan, but critical gaps must be resolved within a defined timeframe.",
    };
  }
  if (nodeAssessments.filter((n) => n.rating === "moderate").length >= 3) {
    return {
      rating: "moderate",
      label: "Moderate — Governance Formalization Needed",
      summary:
        "This deployment has adequate foundational governance but several nodes require formalization. Deployment may proceed. Moderate gaps should be resolved within the first governance review cycle.",
    };
  }
  return {
    rating: "adequate",
    label: "Adequate — Governance Requirements Met",
    summary:
      "This deployment meets baseline governance requirements across assessed nodes. Ongoing monitoring and periodic governance review remain required.",
  };
}

// ─── Priority actions ─────────────────────────────────────────────────────────

function derivePriorityActions(nodeAssessments, isHighRisk) {
  return nodeAssessments
    .filter((n) => n.rating === "critical" || (n.rating === "moderate" && isHighRisk))
    .sort((a, b) => a.priorityOrder - b.priorityOrder)
    .slice(0, 5) // Top 5 priority actions
    .map((n) => ({
      node: n.nodeLabel,
      rating: n.rating,
      topAction: n.recommendations[0] || "Review node and complete missing governance documentation.",
    }));
}

// ─── Gap flags ────────────────────────────────────────────────────────────────

function deriveNodeGapFlags(nodeAssessments) {
  return nodeAssessments
    .filter((n) => n.unknownIsSignal)
    .map(
      (n) =>
        `${n.nodeLabel}: ${n.unknownCount} signal questions unanswered — node rating may understate risk. Unknown is a governance signal.`
    );
}

// ─── Cross-node dependency warnings ──────────────────────────────────────────

function buildCrossNodeWarnings(nodeAssessments) {
  const warnings = [];
  const byId = Object.fromEntries(nodeAssessments.map((n) => [n.nodeId, n]));

  // Authority + Stop: stop criteria without authority owner = unactionable
  if (byId.stop?.rating === "adequate" && byId.authority?.rating === "critical") {
    warnings.push(
      "Stop criteria are defined but authority is unassigned. Stop mechanisms without a named decision owner are not actionable — the criteria exist but no one has clear authority to execute them."
    );
  }

  // H1 + Override: human review without override capability = review theater
  if (byId.h1?.rating === "adequate" && byId.override?.rating === "critical") {
    warnings.push(
      "Human review is defined but clinician override is not enabled. A human reviewer who cannot override the model output is performing review theater, not governance."
    );
  }

  // Watcher + H4: monitoring without governance body = data with no home
  if (byId.watcher?.rating === "adequate" && byId.h4?.rating === "critical") {
    warnings.push(
      "Monitoring is in place but no governance body exists to receive and act on monitoring findings. Monitoring data without a governance home is logged but not governed."
    );
  }

  // Validation + Watcher: validation without ongoing monitoring = point-in-time only
  if (byId.validation?.rating === "adequate" && byId.watcher?.rating === "critical") {
    warnings.push(
      "Local validation was performed but no ongoing monitoring owner is assigned. Validation is a point-in-time assessment. Without ongoing monitoring, the governance posture degrades to the day the validation was completed."
    );
  }

  return warnings;
}
