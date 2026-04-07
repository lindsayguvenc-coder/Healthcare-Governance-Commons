// api/westgard-tiers.js
// Item 11 — Westgard-adapted tier builder
// Translates Westgard multi-rule QC logic into ML inference monitoring tiers.
// Input: full VPG state object (answers, logicFlags, gapFlags)
// Output: structured JSON for PDF Section 4 (Monitoring & Tier Thresholds)

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { answers = {}, logicFlags = {}, gapFlags = [] } = req.body;

    const result = buildWestgardTiers({ answers, logicFlags, gapFlags });

    return res.status(200).json(result);
  } catch (err) {
    console.error("westgard-tiers error:", err);
    return res.status(500).json({ error: "Tier builder failed", detail: err.message });
  }
}

// ─── Core builder ────────────────────────────────────────────────────────────

function buildWestgardTiers({ answers, logicFlags, gapFlags }) {
  const useType = answers.Q2 || "unknown";
  const sensitivity = parseFloat(answers.Q15) || null;
  const specificity = parseFloat(answers.Q16) || null;
  const prevalence = parseFloat(answers.Q17) || null;
  const population = answers.Q8 || null;
  const decisionWindow = answers.Q24 || null;
  const corrActOwner = answers.Q28 || null;
  const priorAuditData = answers.Q35 === "yes";
  const driftDefined = answers.Q36 === "yes";
  const isHighRisk = logicFlags.includes("HIGH_AUTONOMY") || logicFlags.includes("DIRECT_CLINICAL_DECISION");
  const isFullProtocol = !logicFlags.includes("WORKFLOW_SUMMARY_MODE");

  // Derive PPV/NPV if possible
  const metrics = deriveMetrics({ sensitivity, specificity, prevalence });

  // Select tier profile based on use type
  const tierProfile = selectTierProfile(useType, isHighRisk, metrics, decisionWindow);

  // Apply Westgard rule mapping
  const westgardMapping = mapWestgardRules(tierProfile, metrics, priorAuditData);

  // Population-stratified control limits
  const stratifiedLimits = buildStratifiedLimits(population, metrics, tierProfile);

  // Governance ownership statement
  const ownershipStatement = buildOwnershipStatement(corrActOwner, useType);

  // Gap flags for tier section
  const tierGapFlags = [];
  if (!sensitivity) tierGapFlags.push("Sensitivity not provided — warning thresholds estimated from use-type defaults.");
  if (!specificity) tierGapFlags.push("Specificity not provided — tier bounds are indicative only.");
  if (!prevalence) tierGapFlags.push("Local prevalence unknown — PPV/NPV cannot be calculated; fixed thresholds used.");
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
    tierGapFlags,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Metric derivation ────────────────────────────────────────────────────────

function deriveMetrics({ sensitivity, specificity, prevalence }) {
  const metrics = {
    sensitivity: sensitivity ? sensitivity / 100 : null,
    specificity: specificity ? specificity / 100 : null,
    prevalence: prevalence ? prevalence / 100 : null,
    ppv: null,
    npv: null,
    likelihoodRatioPos: null,
    likelihoodRatioNeg: null,
    calculable: false,
  };

  if (metrics.sensitivity !== null && metrics.specificity !== null && metrics.prevalence !== null) {
    const tp = metrics.sensitivity * metrics.prevalence;
    const fp = (1 - metrics.specificity) * (1 - metrics.prevalence);
    const fn = (1 - metrics.sensitivity) * metrics.prevalence;
    const tn = metrics.specificity * (1 - metrics.prevalence);

    metrics.ppv = tp / (tp + fp);
    metrics.npv = tn / (tn + fn);
    metrics.likelihoodRatioPos = metrics.sensitivity / (1 - metrics.specificity);
    metrics.likelihoodRatioNeg = (1 - metrics.sensitivity) / metrics.specificity;
    metrics.calculable = true;
  }

  // Format for display
  if (metrics.ppv !== null) metrics.ppvDisplay = `${(metrics.ppv * 100).toFixed(1)}%`;
  if (metrics.npv !== null) metrics.npvDisplay = `${(metrics.npv * 100).toFixed(1)}%`;
  if (metrics.likelihoodRatioPos !== null) metrics.lrPosDisplay = metrics.likelihoodRatioPos.toFixed(2);
  if (metrics.likelihoodRatioNeg !== null) metrics.lrNegDisplay = metrics.likelihoodRatioNeg.toFixed(3);

  return metrics;
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
  unknown: { riskClass: "moderate", falseNegBias: false, tierSensitivity: "moderate" },
};

function selectTierProfile(useType, isHighRisk, metrics, decisionWindow) {
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
    thresholds: deriveThresholds(riskClass, tierSensitivity, metrics),
  };
}

function deriveThresholds(riskClass, tierSensitivity, metrics) {
  // Base threshold tables by risk class
  // All values are % degradation from baseline (established during validation)
  const BASE = {
    high: {
      warning: 3,   // 3% degradation triggers warning review
      action: 7,    // 7% degradation triggers corrective action
      stop: 12,     // 12% degradation triggers stop/failover
    },
    moderate: {
      warning: 5,
      action: 12,
      stop: 20,
    },
    low: {
      warning: 8,
      action: 18,
      stop: 30,
    },
  };

  const base = BASE[riskClass] || BASE.moderate;

  // Tighten thresholds if high tier sensitivity
  const factor = tierSensitivity === "high" ? 0.75 : tierSensitivity === "low" ? 1.3 : 1.0;

  const thresholds = {
    warning: Math.round(base.warning * factor * 10) / 10,
    action: Math.round(base.action * factor * 10) / 10,
    stop: Math.round(base.stop * factor * 10) / 10,
  };

  // If we have actual metrics, add absolute metric floors alongside relative thresholds
  if (metrics.sensitivity !== null) {
    const sensFactor = riskClass === "high" ? 0.97 : 0.93;
    thresholds.sensitivityFloor = Math.round(metrics.sensitivity * sensFactor * 1000) / 10 + "%";
  }
  if (metrics.specificity !== null) {
    const specFactor = riskClass === "high" ? 0.98 : 0.95;
    thresholds.specificityFloor = Math.round(metrics.specificity * specFactor * 1000) / 10 + "%";
  }

  return thresholds;
}

// ─── Westgard rule mapping ────────────────────────────────────────────────────

function mapWestgardRules(tierProfile, metrics, priorAuditData) {
  const { riskClass, thresholds, falseNegBias } = tierProfile;

  // Westgard rules translated to ML monitoring context
  // 1_2s = 1 observation > 2SD from baseline → warning (translated: single metric >warning threshold)
  // 1_3s = 1 observation > 3SD → reject (translated: single metric >stop threshold)
  // 2_2s = 2 consecutive > 2SD → action (translated: 2 consecutive >warning → corrective action)
  // R_4s = range > 4SD in same run (translated: max-min spread across sample batches > action threshold)
  // 4_1s = 4 consecutive same direction (translated: 4 consecutive degrading observations → trend alert)
  // 10_x = 10 consecutive same side of mean (translated: sustained systematic drift)

  const rules = [
    {
      westgardAnalog: "1₂ₛ (Warning rule)",
      mlTranslation: "Single metric observation crosses warning threshold",
      threshold: `${thresholds.warning}% degradation from validation baseline`,
      response: "Flag for human review at next scheduled review cycle. No immediate action required.",
      tier: "warning",
      active: true,
    },
    {
      westgardAnalog: "1₃ₛ (Rejection rule)",
      mlTranslation: "Single metric observation crosses stop threshold",
      threshold: `${thresholds.stop}% degradation from validation baseline`,
      response: "Immediate escalation to designated corrective action owner. Activate failover or human override pathway.",
      tier: "stop",
      active: true,
    },
    {
      westgardAnalog: "2₂ₛ (Action rule)",
      mlTranslation: "Two consecutive observations exceed warning threshold",
      threshold: `2 consecutive monitoring cycles each showing >${thresholds.warning}% degradation`,
      response: "Corrective action initiated. Root cause assessment required before next deployment cycle.",
      tier: "action",
      active: true,
    },
    {
      westgardAnalog: "R₄ₛ (Range rule)",
      mlTranslation: "Inter-batch performance spread exceeds action threshold",
      threshold: `Max minus min across a monitoring window > ${thresholds.action}%`,
      response: "Cohort stratification review. Check for subgroup performance differential — possible demographic performance gap.",
      tier: "action",
      active: true,
    },
    {
      westgardAnalog: "4₁ₛ (Trend rule)",
      mlTranslation: "Four consecutive observations drifting same direction",
      threshold: "4 consecutive monitoring periods showing monotonic degradation regardless of threshold crossing",
      response: "Drift investigation triggered. Determine if systematic (model drift) or data quality issue. Corrective action plan required.",
      tier: "action",
      active: true,
    },
    {
      westgardAnalog: "10ₓ (Shift rule)",
      mlTranslation: "Ten consecutive observations on same side of baseline mean",
      threshold: "10 consecutive monitoring periods where performance is consistently below (or above) baseline mean",
      response: "Systematic shift confirmed. Model revalidation required. Deployment pause recommended pending root cause.",
      tier: "stop",
      active: priorAuditData, // Only actionable if there is baseline audit data to compare against
      note: priorAuditData ? null : "Requires established baseline audit data — not yet applicable for this deployment.",
    },
  ];

  // If false-negative bias (missing true positives is higher risk), add sensitivity-specific rule
  if (falseNegBias) {
    rules.push({
      westgardAnalog: "Sensitivity-specific floor (adapted)",
      mlTranslation: "Sensitivity drops below absolute floor regardless of relative threshold",
      threshold: thresholds.sensitivityFloor
        ? `Sensitivity < ${thresholds.sensitivityFloor}`
        : "Sensitivity floor not calculable — prevalence data required",
      response: "Immediate stop. For this use type, missed true positives carry higher harm potential than false positives. Failover to human review required.",
      tier: "stop",
      active: !!thresholds.sensitivityFloor,
      note: "False-negative bias declared for this use type. Sensitivity floor is a hard stop, not a warning.",
    });
  }

  const phaseInNote = priorAuditData
    ? null
    : "Note: Shift and trend rules (4₁ₛ, 10ₓ) require a minimum of 20 monitoring observations to establish a reliable baseline. Apply warning and rejection rules first; phase in trend/shift rules as baseline accumulates.";

  return { rules, phaseInNote };
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
        ? `Disaggregate monitoring metrics by ${ax.axis}. Flag if any subgroup performance deviates >${tierProfile.thresholds.warning}% from aggregate.`
        : `Monitor ${ax.axis} subgroups quarterly or when aggregate threshold crossings occur.`,
      dataRequirement: `Local EHR stratification by ${ax.axis} required. If unavailable, flag as monitoring gap.`,
      priority: ax.priority,
    });
  }

  rationale.push(
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
