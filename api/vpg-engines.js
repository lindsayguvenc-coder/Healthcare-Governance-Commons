// api/vpg-engines.js
// Consolidated VPG engine route — Items 11, 12, 13 in one function.
// Dispatches to the correct engine based on the `engine` param.
// Called by api/generate-protocol.js in parallel for each engine.
//
// POST body: { engine: 'westgard' | 'bias' | 'nodes', answers, logicFlags, gapFlags }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { engine, answers = {}, logicFlags = [], gapFlags = [] } = req.body;

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
  if (!raw || raw === "not_disclosed" || raw === "") {
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
      recommendedAction = `Vendor non-disclosure on ${axis.label} — cannot assess compatibility. Local site records this axis. Treat as potential mismatch pending vendor disclosure.`;
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

  if (vendorNonDisclosure) {
    flags.push("VENDOR_NON_DISCLOSURE: Vendor has not provided demographic breakdown of training data. Compatibility assessment is incomplete.");
  }
  if (localMethodology.unknown) {
    flags.push("LOCAL_METHODOLOGY_UNKNOWN: Local demographic recording methodology not documented. Subgroup performance monitoring is not possible until this is resolved.");
  }
  if (!modelCardAvailable) {
    flags.push("NO_MODEL_CARD: Model card not available or not reviewed. Bias assessment relies on self-reported vendor information only.");
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
