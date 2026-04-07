// api/commons-node-mapper.js
// Item 13 — Commons node risk mapper
// Maps VPG elicitation answers to the 10 Commons taxonomy nodes.
// Produces per-node risk rating (critical / moderate / adequate) + recommended governance actions.
// Same triage logic as Governance Assessment output, scoped to this specific deployment.
// Input: full VPG state object (answers, logicFlags, gapFlags)
// Output: structured JSON for PDF Section 5 (Governance Node Assessment)

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { answers = {}, logicFlags = [], gapFlags = [] } = req.body;

    const result = mapCommonsNodes({ answers, logicFlags, gapFlags });

    return res.status(200).json(result);
  } catch (err) {
    console.error("commons-node-mapper error:", err);
    return res.status(500).json({ error: "Node mapper failed", detail: err.message });
  }
}

// ─── Node definitions ─────────────────────────────────────────────────────────
// The 10 Commons taxonomy nodes with their governance domains and signal sources

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
