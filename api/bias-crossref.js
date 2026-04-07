// api/bias-crossref.js
// Item 12 — Bias cross-reference engine
// Two modes: full (mapping function + color-coded table) or qualitative (narrative summary)
// Input: full VPG state object (answers, logicFlags, gapFlags)
// Output: structured JSON for PDF Section 3 (Bias & Fairness Assessment)
// Bias never disappears — no opt-out exists in either mode.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { answers = {}, logicFlags = [], gapFlags = [] } = req.body;

    const isFullProtocol = !logicFlags.includes("WORKFLOW_SUMMARY_MODE");
    const result = runBiasCrossref({ answers, logicFlags, gapFlags, isFullProtocol });

    return res.status(200).json(result);
  } catch (err) {
    console.error("bias-crossref error:", err);
    return res.status(500).json({ error: "Bias cross-reference failed", detail: err.message });
  }
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

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
