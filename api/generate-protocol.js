// api/generate-protocol.js
// Item 14 — Validation Protocol PDF Orchestrator
// Calls vpg-engines (consolidated) in parallel for each engine.
// Assembles the full 7-section protocol object and returns it for client-side PDF rendering.
// The client (jsPDF) handles actual PDF generation — this route produces the structured data.
//
// Input:  { answers, logicFlags, gapFlags, documents (metadata only, no PHI) }
// Output: { protocol: { sections: [...], meta, gapFlags, logicFlags } }

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { answers = {}, logicFlags = [], gapFlags = [], documentMeta = [] } = req.body;

    if (!answers || Object.keys(answers).length === 0) {
      return res.status(400).json({ error: "No answers provided. Complete elicitation before generating protocol." });
    }

    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

    // Call all three engines in parallel
    const [tiersResult, biasResult, nodesResult] = await Promise.all([
      callEngine(`${baseUrl}/api/vpg-engines`, { engine: 'westgard', answers, logicFlags, gapFlags }),
      callEngine(`${baseUrl}/api/vpg-engines`, { engine: 'bias', answers, logicFlags, gapFlags }),
      callEngine(`${baseUrl}/api/vpg-engines`, { engine: 'nodes', answers, logicFlags, gapFlags }),
    ]);

    // Assemble full protocol object
    const protocol = assembleProtocol({
      answers,
      logicFlags,
      gapFlags,
      documentMeta,
      tiersResult,
      biasResult,
      nodesResult,
    });

    return res.status(200).json({ protocol });
  } catch (err) {
    console.error("generate-protocol error:", err);
    return res.status(500).json({ error: "Protocol generation failed", detail: err.message });
  }
}

// ─── Engine caller ────────────────────────────────────────────────────────────

async function callEngine(url, body) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errText = await response.text();
      console.error(`Engine call failed for ${url}:`, errText);
      return { error: true, url, status: response.status };
    }
    return await response.json();
  } catch (err) {
    console.error(`Engine fetch error for ${url}:`, err.message);
    return { error: true, url, message: err.message };
  }
}

// ─── Protocol assembler ───────────────────────────────────────────────────────

function assembleProtocol({ answers, logicFlags, gapFlags, documentMeta, tiersResult, biasResult, nodesResult }) {
  const isFullProtocol = !logicFlags.includes("WORKFLOW_SUMMARY_MODE");
  const useType = answers.Q2 || "unknown";
  const deploymentName = answers.Q1 || "Unnamed AI Deployment";
  const institution = answers.Q3 || "Institution not specified";
  const generatedAt = new Date().toISOString();
  const generatedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  // Collect all gap flags across sections
  const allGapFlags = [
    ...gapFlags,
    ...(tiersResult.tierGapFlags || []),
    ...(biasResult.biasGapFlags || []),
    ...(nodesResult.nodeGapFlags || []),
  ].filter(Boolean);

  // Derive overall protocol risk signal
  const overallNodeRating = nodesResult.overallRating || { rating: "unknown", label: "Assessment incomplete", summary: "" };
  const biasSummaryRating = biasResult.compatibilityTable?.summary?.overallRating || biasResult.mode === "qualitative" ? "qualitative" : "unknown";

  return {
    meta: {
      title: `Validation Protocol: ${deploymentName}`,
      deploymentName,
      institution,
      useType,
      isFullProtocol,
      protocolMode: isFullProtocol ? "Full Validation Protocol" : "Workflow Summary Protocol",
      generatedAt,
      generatedDate,
      version: "1.0",
      shelfLifeStatement: "This document has a shelf life. A validation protocol that is never updated is not a governance document — it is a record of past intentions.",
      commonsVersion: "Healthcare Governance Commons v1",
    },
    overallRating: overallNodeRating,
    biasSummaryRating,
    allGapFlags,
    logicFlags,
    sections: [
      buildSection1(answers, documentMeta, isFullProtocol),
      buildSection2(answers, isFullProtocol),
      buildSection3(biasResult, isFullProtocol),
      buildSection4(tiersResult, isFullProtocol),
      buildSection5(nodesResult, isFullProtocol),
      buildSection6(answers, tiersResult, nodesResult, isFullProtocol),
      buildSection7(answers, allGapFlags, overallNodeRating, isFullProtocol),
    ],
  };
}

// ─── Section builders ─────────────────────────────────────────────────────────

// Section 1: Deployment Context & Scope
function buildSection1(answers, documentMeta, isFullProtocol) {
  return {
    sectionNumber: 1,
    title: "Deployment Context & Scope",
    subsections: [
      {
        title: "Deployment Identification",
        content: {
          deploymentName: answers.Q1 || "Not specified",
          useType: answers.Q2 || "Not specified",
          institution: answers.Q3 || "Not specified",
          department: answers.Q4 || "Not specified",
          deploymentDate: answers.Q5 || "Not specified",
          vendor: answers.Q6 || "Not specified",
          modelVersion: answers.Q7 || "Not specified",
        },
      },
      {
        title: "Clinical Context",
        content: {
          clinicalSetting: answers.Q8 || "Not specified",
          targetPopulation: answers.Q9 || "Not specified",
          intendedUseDescription: answers.Q_use_description || answers.Q_S1_describe || "Not provided",
          autonomyLevel: answers.Q_autonomy || "Not specified",
          decisionWindow: answers.Q24 || "Not specified",
          patientVolumeAffected: answers.Q_volume || "Not specified",
        },
      },
      {
        title: "Documents Reviewed",
        content: {
          documentCount: documentMeta.length,
          documents: documentMeta.map((d) => ({
            name: d.name || "Unnamed document",
            type: d.type || "Unknown type",
            pagesOrSize: d.pages ? `${d.pages} pages` : d.size ? `${d.size}` : "—",
            phiScanResult: d.phiResult || "Not scanned",
          })),
          noDocumentsNote:
            documentMeta.length === 0
              ? "No documents were uploaded during elicitation. Protocol is based on responses only."
              : null,
        },
      },
      isFullProtocol
        ? {
            title: "Protocol Scope",
            content: {
              protocolType: "Full Validation Protocol",
              scopeNote:
                "This protocol covers full quantitative validation, bias assessment with mapping function, Westgard-adapted monitoring tiers, and Commons node risk assessment.",
            },
          }
        : {
            title: "Protocol Scope",
            content: {
              protocolType: "Workflow Summary Protocol",
              scopeNote:
                "This protocol covers workflow integration, qualitative bias assessment, and governance node review. Quantitative validation thresholds and full bias mapping require a full validation protocol.",
            },
          },
    ],
  };
}

// Section 2: Model Characterization & Performance Baseline
function buildSection2(answers, isFullProtocol) {
  const hasMetrics = answers.Q15 || answers.Q16;
  return {
    sectionNumber: 2,
    title: isFullProtocol ? "Model Characterization & Performance Baseline" : "Model Characterization",
    subsections: [
      {
        title: "Vendor-Reported Characteristics",
        content: {
          modelArchitecture: answers.Q10 || "Not disclosed",
          trainingDataDescription: answers.Q11 || "Not disclosed",
          vendorValidationSummary: answers.Q12 || "Not disclosed",
          modelCardAvailable: answers.Q19 === "yes" ? "Yes" : "No / Not reviewed",
          fdaStatus: answers.Q_fda || "Not specified",
        },
      },
      isFullProtocol
        ? {
            title: "Local Validation Baseline",
            content: {
              localValidationPerformed: answers.Q_local_validation === "yes" || answers.Q12 === "yes" ? "Yes" : "Not yet performed — see gap flags",
              sensitivity: answers.Q15 ? `${answers.Q15}%` : "Not provided",
              specificity: answers.Q16 ? `${answers.Q16}%` : "Not provided",
              prevalence: answers.Q17 ? `${answers.Q17}%` : "Not provided",
              auc: answers.Q_auc || "Not provided",
              f1: answers.Q_f1 || "Not provided",
              validationCohortSize: answers.Q_cohort_size || "Not provided",
              validationCohortDescription: answers.Q_cohort_description || "Not provided",
              metricsNote: !hasMetrics
                ? "No performance metrics provided. Monitoring thresholds in Section 4 are based on use-type defaults. Provide local validation metrics to generate deployment-specific thresholds."
                : null,
            },
          }
        : {
            title: "Performance Summary",
            content: {
              performanceSummary: answers.Q_perf_summary || "Not provided",
              workflowIntegrationNote: answers.Q_workflow_note || "Not provided",
            },
          },
      {
        title: "Known Limitations",
        content: {
          vendorDisclosedLimitations: answers.Q_vendor_limitations || "None disclosed",
          locallyIdentifiedLimitations: answers.Q_local_limitations || "None identified during elicitation",
          contraindications: answers.Q_contraindications || "None specified",
        },
      },
    ],
  };
}

// Section 3: Bias & Fairness Assessment (from bias-crossref engine)
function buildSection3(biasResult, isFullProtocol) {
  if (biasResult.error) {
    return {
      sectionNumber: 3,
      title: "Bias & Fairness Assessment",
      error: true,
      errorNote: "Bias assessment engine failed to run. This section requires manual completion.",
      principleStatement: "Bias assessment is required regardless of model card availability or vendor disclosure posture.",
    };
  }

  return {
    sectionNumber: 3,
    title: "Bias & Fairness Assessment",
    mode: biasResult.mode,
    principleStatement: biasResult.principleStatement,
    vendorNonDisclosure: biasResult.vendorNonDisclosure,
    subsections: isFullProtocol
      ? [
          {
            title: "Training Data Demographic Coverage",
            content: {
              vendorDemographics: biasResult.vendorDemographics,
              localMethodology: biasResult.localMethodology,
              modelCardAvailable: biasResult.modelCardAvailable,
            },
          },
          {
            title: "Compatibility Assessment",
            content: {
              compatibilityTable: biasResult.compatibilityTable,
              tableSummary: biasResult.compatibilityTable?.summary,
            },
          },
          {
            title: "Mismatch Flags",
            content: {
              flags: biasResult.mismatchFlags || [],
              flagCount: (biasResult.mismatchFlags || []).length,
            },
          },
          {
            title: "Unaddressed Risks",
            content: {
              risks: biasResult.unaddressedRisks || [],
            },
          },
        ]
      : [
          {
            title: "Population Mismatch Summary",
            content: {
              narrativeSummary: biasResult.narrativeSummary,
            },
          },
          {
            title: "Named Risks",
            content: {
              risks: biasResult.namedRisks || [],
              mismatchFlags: biasResult.mismatchFlags || [],
            },
          },
        ],
    biasGapFlags: biasResult.biasGapFlags || [],
  };
}

// Section 4: Monitoring Framework & Tier Thresholds (from westgard-tiers engine)
function buildSection4(tiersResult, isFullProtocol) {
  if (tiersResult.error) {
    return {
      sectionNumber: 4,
      title: "Monitoring Framework & Tier Thresholds",
      error: true,
      errorNote: "Tier builder engine failed to run. This section requires manual completion.",
    };
  }

  return {
    sectionNumber: 4,
    title: "Monitoring Framework & Tier Thresholds",
    subsections: [
      {
        title: "Performance Metrics Baseline",
        content: {
          metrics: tiersResult.metrics,
          metricsNote: !tiersResult.metrics?.calculable
            ? "PPV and NPV could not be calculated. Local prevalence was not provided or performance metrics were not provided. Thresholds below are use-type defaults."
            : null,
        },
      },
      {
        title: "Tier Profile",
        content: {
          riskClass: tiersResult.tierProfile?.riskClass,
          tierSensitivity: tiersResult.tierProfile?.tierSensitivity,
          thresholds: tiersResult.tierProfile?.thresholds,
          rationale: [
            tiersResult.tierProfile?.falseNegBias ? "False-negative bias declared for this use type — sensitivity floor is a hard stop." : null,
            tiersResult.tierProfile?.ppvLow ? "PPV below 60% — thresholds tightened to reduce false positive burden." : null,
            tiersResult.tierProfile?.urgentWindow ? "Urgent decision window — thresholds tightened for time-sensitive clinical context." : null,
          ].filter(Boolean),
        },
      },
      {
        title: "Westgard-Adapted Monitoring Rules",
        content: {
          rules: tiersResult.westgardMapping?.rules || [],
          phaseInNote: tiersResult.westgardMapping?.phaseInNote,
        },
      },
      {
        title: "Population-Stratified Control Limits",
        content: {
          rationale: tiersResult.stratifiedLimits?.rationale || [],
          stratifiedGroups: tiersResult.stratifiedLimits?.stratifiedGroups || [],
          gaps: tiersResult.stratifiedLimits?.gaps || [],
        },
      },
      {
        title: "Governance Ownership",
        content: {
          ownershipStatement: tiersResult.ownershipStatement,
        },
      },
    ],
    tierGapFlags: tiersResult.tierGapFlags || [],
  };
}

// Section 5: Governance Node Assessment (from commons-node-mapper engine)
function buildSection5(nodesResult, isFullProtocol) {
  if (nodesResult.error) {
    return {
      sectionNumber: 5,
      title: "Governance Node Assessment",
      error: true,
      errorNote: "Node mapper engine failed to run. This section requires manual completion.",
    };
  }

  return {
    sectionNumber: 5,
    title: "Governance Node Assessment",
    taxonomyNote: nodesResult.taxonomyNote,
    overallRating: nodesResult.overallRating,
    subsections: [
      {
        title: "Node-by-Node Assessment",
        content: {
          nodeAssessments: nodesResult.nodeAssessments || [],
        },
      },
      {
        title: "Cross-Node Dependency Warnings",
        content: {
          warnings: nodesResult.crossNodeWarnings || [],
        },
      },
      {
        title: "Priority Actions",
        content: {
          priorityActions: nodesResult.priorityActions || [],
        },
      },
    ],
    nodeGapFlags: nodesResult.nodeGapFlags || [],
  };
}

// Section 6: Implementation Readiness & Deployment Conditions
function buildSection6(answers, tiersResult, nodesResult, isFullProtocol) {
  const criticalNodeCount = (nodesResult.nodeAssessments || []).filter((n) => n.rating === "critical").length;
  const hasStopCriteria = !!(answers.Q34 || answers.Q_stop_criteria);
  const hasFailover = !!answers.Q_failover;
  const hasMonitoringOwner = !!answers.Q28;

  const deploymentReadiness = deriveReadiness(criticalNodeCount, hasStopCriteria, hasMonitoringOwner, isFullProtocol);

  return {
    sectionNumber: 6,
    title: "Implementation Readiness & Deployment Conditions",
    deploymentReadiness,
    subsections: [
      {
        title: "Pre-Deployment Checklist",
        content: {
          items: [
            { item: "Local validation performed or formally deferred with documented rationale", status: answers.Q_local_validation === "yes" ? "complete" : "incomplete" },
            { item: "Monitoring owner named and notified", status: hasMonitoringOwner ? "complete" : "incomplete" },
            { item: "Stop criteria defined and documented", status: hasStopCriteria ? "complete" : "incomplete" },
            { item: "Failover workflow documented", status: hasFailover ? "complete" : "incomplete" },
            { item: "Staff training completed or scheduled", status: answers.Q39 === "yes" ? "complete" : "incomplete" },
            { item: "Use policy approved", status: answers.Q38 === "yes" ? "complete" : "incomplete" },
            { item: "Patient consent process defined (if applicable)", status: answers.Q40 === "yes" ? "complete" : "n/a-review-required" },
            { item: "Bias assessment reviewed by clinical governance", status: (nodesResult.overallRating?.rating !== "critical") ? "recommended" : "required" },
            { item: "Corrective action owner designated", status: answers.Q28 ? "complete" : "incomplete" },
            { item: "Revalidation trigger criteria defined", status: answers.Q_revalidation_trigger ? "complete" : "incomplete" },
          ],
        },
      },
      {
        title: "Deployment Conditions",
        content: {
          conditions: buildDeploymentConditions(answers, tiersResult, nodesResult, isFullProtocol),
        },
      },
      {
        title: "Revalidation Triggers",
        content: {
          triggers: [
            "Any monitoring tier threshold crossing (action level or stop level)",
            "Significant change to patient population (new service lines, population shifts)",
            "Model update or version change by vendor",
            "Change in clinical workflow that affects model input data",
            "Merger, acquisition, or significant organizational change",
            answers.Q_revalidation_trigger || "Additional site-specific revalidation trigger: [not defined — complete before deployment]",
          ],
        },
      },
    ],
  };
}

function deriveReadiness(criticalNodeCount, hasStopCriteria, hasMonitoringOwner, isFullProtocol) {
  if (criticalNodeCount >= 3 || (!hasStopCriteria && !hasMonitoringOwner)) {
    return {
      status: "not_recommended",
      label: "Deployment Not Recommended",
      rationale: "Multiple critical governance gaps identified. Address critical node gaps before proceeding.",
    };
  }
  if (criticalNodeCount >= 1 || !hasStopCriteria || !hasMonitoringOwner) {
    return {
      status: "conditional",
      label: "Conditional Deployment",
      rationale: "Deployment may proceed with documented risk acceptance and a remediation plan with defined timelines for critical gap resolution.",
    };
  }
  return {
    status: "recommended",
    label: "Deployment Conditions Met",
    rationale: "Baseline governance requirements are met. Ongoing monitoring and periodic review remain required.",
  };
}

function buildDeploymentConditions(answers, tiersResult, nodesResult, isFullProtocol) {
  const conditions = [];

  if (!answers.Q28) {
    conditions.push("REQUIRED BEFORE GO-LIVE: Name and designate monitoring owner.");
  }
  if (!answers.Q34 && !answers.Q_stop_criteria) {
    conditions.push("REQUIRED BEFORE GO-LIVE: Define and document stop criteria.");
  }
  if (!answers.Q_failover) {
    conditions.push("REQUIRED BEFORE GO-LIVE: Document failover workflow.");
  }

  const criticalNodes = (nodesResult.nodeAssessments || []).filter((n) => n.rating === "critical");
  for (const node of criticalNodes) {
    conditions.push(`REQUIRED: Resolve critical gap in ${node.nodeLabel} node. ${node.recommendations?.[0] || ""}`);
  }

  if (conditions.length === 0) {
    conditions.push("All baseline deployment conditions met. Proceed with standard monitoring protocol.");
  }

  return conditions;
}

// Section 7: Governance Summary & Open Items
function buildSection7(answers, allGapFlags, overallNodeRating, isFullProtocol) {
  return {
    sectionNumber: 7,
    title: "Governance Summary & Open Items",
    subsections: [
      {
        title: "Overall Governance Assessment",
        content: {
          rating: overallNodeRating,
          assessmentDate: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
          protocolPreparedBy: answers.Q_preparer || "Not specified",
          reviewedBy: answers.Q_reviewer || "Pending review",
          approvedBy: answers.Q_approver || "Pending approval",
        },
      },
      {
        title: "Consolidated Gap Flags",
        content: {
          totalGaps: allGapFlags.length,
          flags: allGapFlags,
          noGapsNote: allGapFlags.length === 0 ? "No gap flags generated. Review elicitation completeness." : null,
        },
      },
      {
        title: "Open Items Log",
        content: {
          items: buildOpenItemsLog(answers, allGapFlags),
          note: "Open items should be assigned to named owners with target resolution dates before this protocol is considered complete.",
        },
      },
      {
        title: "Next Scheduled Review",
        content: {
          nextReviewDate: answers.Q_next_review || "Not specified — set before deployment",
          reviewCadence: answers.Q_review_cadence || "Recommended: quarterly for first year, then annually unless monitoring triggers earlier review",
          reviewOwner: answers.Q28 || "Not assigned",
        },
      },
      {
        title: "Protocol Provenance",
        content: {
          generatedBy: "Healthcare Governance Commons — Validation Protocol Generator",
          generatedAt: new Date().toISOString(),
          commonsUrl: "healthcare-governance-commons.vercel.app",
          shelfLifeStatement: "This document has a shelf life. A validation protocol that is never updated is not a governance document — it is a record of past intentions.",
          versionStatement: "Version 1.0. Update this document when any revalidation trigger is met or when organizational context changes materially.",
        },
      },
    ],
  };
}

function buildOpenItemsLog(answers, allGapFlags) {
  const items = [];
  let itemNumber = 1;

  for (const flag of allGapFlags.slice(0, 15)) { // Cap at 15 for PDF readability
    items.push({
      number: itemNumber++,
      description: flag,
      owner: "Unassigned",
      targetDate: "Not set",
      status: "Open",
    });
  }

  if (items.length === 0) {
    items.push({
      number: 1,
      description: "Review all elicitation responses for completeness.",
      owner: answers.Q28 || "Unassigned",
      targetDate: "Before go-live",
      status: "Open",
    });
  }

  return items;
}
