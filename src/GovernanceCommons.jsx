import { useState, useEffect, useRef } from "react";

// ─── PALETTE ────────────────────────────────────────────────────────────────
const C = {
  bg:           "#07090f",
  surface:      "#0d1117",
  surface2:     "#111820",
  surface3:     "#161f2e",
  border:       "#1c2a3a",
  borderBright: "#2a3f57",
  internal:     "#38bdf8",
  internalDim:  "rgba(56,189,248,0.08)",
  external:     "#10b981",
  externalDim:  "rgba(16,185,129,0.08)",
  handoff:      "#f59e0b",
  handoffDim:   "rgba(245,158,11,0.08)",
  commons:      "#a78bfa",
  commonsDim:   "rgba(167,139,250,0.08)",
  red:          "#f43f5e",
  redDim:       "rgba(244,63,94,0.08)",
  text:         "#dce8f0",
  textDim:      "#607080",
  textDimmer:   "#2d3f50",
  mono:         "'DM Mono', 'Fira Code', monospace",
  serif:        "'DM Serif Display', Georgia, serif",
};

// ─── DATA ────────────────────────────────────────────────────────────────────

const LOOP_META = {
  internal: { label: "Internal Loop",   color: C.internal,  question: "Is it behaving as designed?" },
  handoff:  { label: "Handoff Zone",    color: C.handoff,   question: "Where internal signals become external decisions" },
  external: { label: "External Loop",   color: C.external,  question: "Is what it was designed to do still appropriate?" },
  commons:  { label: "Gov. Commons",    color: C.commons,   question: "Is the governance infrastructure itself current?" },
};

// ─── SINGLE SOURCE OF TRUTH ──────────────────────────────────────────────────
// matrixReady: true  → node appears as a row in the matrix (promoted concept)
// matrixReady: false → node lives in taxonomy only (emerging / not yet promoted)
// matrixUseCases: which use-case columns are populated for this concept
// To add a new concept to the matrix: add it here, set matrixReady: true, list useCases.
// Matrix auto-derives its axes from this data. Nothing else needs to change.

const ALL_USE_CASES = [
  { id: "diagnostic", label: "Diagnostic Aid"  },
  { id: "screening",  label: "Screening Tool"  },
  { id: "monitoring", label: "Monitoring Tool" },
  { id: "triage",     label: "Triage Tool"     },
  { id: "treatment",  label: "Treatment Rec."  },
  { id: "admin",      label: "Admin / Ops AI"  },
];

const TAXONOMY_NODES = [
  {
    id: "norm", loop: "internal", label: "Normalization Layer",
    icon: "⊞",
    question: "Is output translatable to a common schema?",
    components: ["Structural normalization","Semantic normalization","Performance concept taxonomy","Temporal cycle mapping"],
    documents: ["Common schema specification","Vendor output format registry","Semantic equivalence definitions"],
    contention: "Who owns and maintains the schema — and how vendor compliance is enforced",
    gap: "No industry standard exists. Vendor → schema compliance is unresolved.",
    mandatory: true,
    matrixReady: false,
    matrixLabel: null,
    matrixUseCases: [],
  },
  {
    id: "watcher", loop: "internal", label: "Watcher / Signal Layer",
    icon: "◎",
    question: "Is it behaving as designed?",
    components: ["Signal ingestion","Threshold evaluation","State classification","Routing logic"],
    documents: ["Threshold registry","State classification criteria","Routing protocol"],
    contention: "What thresholds are appropriate for each use case — and who has authority to set them",
    gap: "No cross-vendor institution-level monitoring layer exists. Each vendor monitors itself.",
    mandatory: true,
    matrixReady: true,
    matrixLabel: "Performance Monitoring & Drift Detection",
    matrixUseCases: ["diagnostic","screening","monitoring","triage","treatment","admin"],
  },
  {
    id: "h1", loop: "handoff", label: "Escalation Gate (H1)",
    icon: "↑",
    question: "Has an internal signal crossed into human decision territory?",
    components: ["Escalate-tier trigger from Watcher","Required inputs defined","Response window defined","Default action if window lapses"],
    documents: ["Escalation protocol","Response window SLA","Default action registry"],
    contention: "What response window is clinically and operationally appropriate",
    gap: "No defined escalation protocol in standard vendor contracts.",
    mandatory: true,
    matrixReady: true,
    matrixLabel: "Escalation Tiers & Routing Logic",
    matrixUseCases: ["diagnostic","screening","monitoring","triage","treatment","admin"],
  },
  {
    id: "h3", loop: "handoff", label: "Cold Trigger Intake (H3)",
    icon: "⟳",
    question: "Has an external event made the current deployment questionable?",
    components: ["FDA guidance changes","Published evidence updates","Peer institution incidents","Formal intake process"],
    documents: ["External signal monitoring policy","Evidence review triggers","Intake submission format"],
    contention: "Who is responsible for monitoring external signals and how frequently",
    gap: "Almost universally undesigned. Cold triggers have no formal entry point.",
    mandatory: false,
    matrixReady: false,
    matrixLabel: null,
    matrixUseCases: [],
  },
  {
    id: "h2", loop: "handoff", label: "Threshold Authority (H2)",
    icon: "≡",
    question: "Has the external loop revised operating parameters for the internal loop?",
    components: ["Revised threshold documentation","Version control","Authorization record","Implementation handoff"],
    documents: ["Threshold change log","Authorization matrix","Versioned threshold registry"],
    contention: "How quickly threshold revisions must be implemented after authorization",
    gap: "No versioned threshold registry with rationale exists in current deployments.",
    mandatory: true,
    matrixReady: true,
    matrixLabel: "Authority Matrix & Decision Rights",
    matrixUseCases: ["diagnostic","screening","monitoring","triage","treatment","admin"],
  },
  {
    id: "h4", loop: "handoff", label: "Dispute Resolution Return (H4)",
    icon: "⊗",
    question: "Has adjudication produced a system state change?",
    components: ["Finding upheld / modified / withdrawn","Model status change","Threshold update if applicable","Audit record"],
    documents: ["Dispute resolution record","Model status change protocol","Contract amendment triggers"],
    contention: "What model status changes can be mandated vs. recommended",
    gap: "No structured dispute return pathway exists. Disputes resolve through negotiation, not process.",
    mandatory: false,
    matrixReady: true,
    matrixLabel: "Audit Trails & Documentation",
    matrixUseCases: ["diagnostic","screening","monitoring","triage","treatment","admin"],
  },
  {
    id: "escalation", loop: "external", label: "Escalation Review",
    icon: "↑↑",
    question: "Does this signal require a governance decision?",
    components: ["Hot trigger review (time-bounded)","Warm trigger review (scheduled)","Cold trigger review (evidence-based)","Initial triage and routing"],
    documents: ["Review protocol","Triage criteria","Panel composition requirements"],
    contention: "Appropriate panel composition — who must be present for different trigger types",
    gap: "No defined review panel composition standard.",
    mandatory: true,
    matrixReady: false, // overlaps with H1; not yet promoted as separate matrix row
    matrixLabel: null,
    matrixUseCases: [],
  },
  {
    id: "adjudicate", loop: "external", label: "Dispute Adjudication",
    icon: "⊡",
    question: "Is the vendor's counter-evidence sufficient to modify or withdraw the finding?",
    components: ["Structured vendor submission format","Review panel + quorum","Defined timeline","Outcome options","Single appeals path"],
    documents: ["Dispute submission format","Adjudication criteria","Appeals process"],
    contention: "What constitutes sufficient counter-evidence — and who defines sufficiency",
    gap: "No structured adjudication process exists in standard contracts.",
    mandatory: false,
    matrixReady: false,
    matrixLabel: null,
    matrixUseCases: [],
  },
  {
    id: "threshold_review", loop: "external", label: "Threshold Review",
    icon: "◈",
    question: "Are current flip conditions still appropriate?",
    components: ["Annual scheduled review","Event-triggered review","Evidence-triggered review","Authorization and documentation"],
    documents: ["Review schedule","Evidence evaluation criteria","Authorization record format"],
    contention: "How to handle threshold changes mid-deployment without operational disruption",
    gap: "Threshold review is ad hoc or absent in current deployments.",
    mandatory: true,
    matrixReady: false, // emerging — needs more documentation before promotion
    matrixLabel: null,
    matrixUseCases: [],
  },
  {
    id: "authority", loop: "external", label: "Authority Tiers",
    icon: "⊙",
    question: "What action is this governance body authorized to take?",
    components: ["Tier 1: Advisory","Tier 2: Conditional","Tier 3: Suspend (requires fallback)","Tier 4: Terminate (CMO+CIO authority)"],
    documents: ["Authority matrix","Fallback protocol (prerequisite)","Termination protocol"],
    contention: "Tier 3/4 authority is politically difficult to assign — institutions resist hard stop authority",
    gap: "Hard stop authority is formally unassigned at most institutions. Fallback protocols often do not exist at deployment.",
    mandatory: true,
    matrixReady: false, // represented via H2 in matrix; not yet a separate row
    matrixLabel: null,
    matrixUseCases: [],
  },
  {
    id: "stop", loop: "external", label: "Stop Mechanisms",
    icon: "⊗",
    question: "What conditions mandate halting the AI system?",
    components: ["Hard stop triggers (automated)","Soft stop triggers (human-initiated)","Kill switch authority chain","Fallback protocol activation"],
    documents: ["Stop condition registry","Kill switch authority matrix","Fallback protocol"],
    contention: "Debate: fixed vs. dynamic confidence thresholds for automated stops",
    gap: "Hard stop authority is formally unassigned at most institutions.",
    mandatory: true,
    matrixReady: true,
    matrixLabel: "Stop Mechanisms & Automated Triggers",
    matrixUseCases: ["diagnostic","screening","monitoring","triage","treatment","admin"],
  },
  {
    id: "override", loop: "external", label: "Human Override Protocols",
    icon: "⟳",
    question: "How are clinician overrides of AI recommendations logged, reviewed, and fed back?",
    components: ["Override logging (automatic)","Override rate as KPI","Quarterly override review","Feedback pathway to model team"],
    documents: ["Override protocol","Override rate thresholds","Feedback loop specification"],
    contention: "Too-easy override → automation complacency. Too-hard → alarm fatigue workarounds.",
    gap: "No standard for what override rate is healthy vs. a signal of system failure.",
    mandatory: true,
    matrixReady: true,
    matrixLabel: "Human Oversight & Override Protocols",
    matrixUseCases: ["diagnostic","screening","monitoring","triage","treatment","admin"],
  },
  {
    id: "validation", loop: "external", label: "Deployment Readiness & Validation",
    icon: "✓",
    question: "Has this AI system met the bar for clinical deployment?",
    components: ["Clinical validation","Analytical validation","EHR integration testing","FDA clearance pathway","Training-serving skew check"],
    documents: ["Validation protocol","Clinical evidence summary","FDA submission record","Go/no-go criteria"],
    contention: "RCT vs. real-world evidence as validation standard — no consensus",
    gap: "Admin AI validation has no standard framework.",
    mandatory: true,
    matrixReady: true,
    matrixLabel: "Deployment Readiness & Validation",
    matrixUseCases: ["diagnostic","screening","monitoring","triage","treatment","admin"],
  },
  {
    id: "commons", loop: "commons", label: "Governance Commons",
    icon: "◉",
    question: "Is the governance infrastructure itself current, neutral, and authoritative?",
    components: ["Schema ownership + versioning","Threshold registry","Audit trail","Document + process layer"],
    documents: ["Commons charter","Schema specification","Threshold registry","This taxonomy"],
    contention: "Funding, staffing, and authority source for the commons itself",
    gap: "Does not exist. This is the work.",
    mandatory: true,
    matrixReady: false,
    matrixLabel: null,
    matrixUseCases: [],
  },
];

// ─── DERIVED MATRIX AXES (auto-computed from taxonomy) ───────────────────────
// To promote a taxonomy node to the matrix: set matrixReady: true above.
// To add a new use case: add it to ALL_USE_CASES above.
// Nothing below needs to change.
const MATRIX_CONCEPTS = TAXONOMY_NODES
  .filter(n => n.matrixReady && n.matrixLabel)
  .map(n => ({ id: n.id, label: n.matrixLabel, icon: n.icon, loop: n.loop }));

const MATRIX_USECASES = ALL_USE_CASES;

// ─── MATRIX CELLS ─────────────────────────────────────────────────────────────
// Keys: "{taxonomyNodeId}-{useCaseId}"
// When a node gets matrixReady:true, its cells appear automatically.
// status: live | sparse | gap
const MATRIX_CELLS = {
  // h2 (Threshold Authority) → Authority Matrix concept
  "h2-diagnostic":          { d:4,c:2,x:2,v:3, status:"live",   summary:"Who decides routing threshold? FDA 510(k) predicate logic applies." },
  "h2-screening":           { d:3,c:1,x:1,v:2, status:"live",   summary:"Population-level screening authority differs from individual clinical decisions." },
  "h2-monitoring":          { d:2,c:1,x:0,v:1, status:"sparse", summary:"Ongoing authority for model drift is often unclear post-deployment." },
  "h2-triage":              { d:3,c:2,x:2,v:2, status:"live",   summary:"Time-critical decisions require pre-defined authority chains." },
  "h2-treatment":           { d:2,c:0,x:3,v:1, status:"sparse", summary:"Prescribing authority cannot be delegated to algorithm." },
  "h2-admin":               { d:1,c:1,x:0,v:1, status:"sparse", summary:"Workflow AI authority is lower stakes but underdocumented." },
  // h1 (Escalation Gate) → Escalation Tiers concept
  "h1-diagnostic":          { d:3,c:2,x:1,v:3, status:"live",   summary:"Confidence score → routing tier mapping. When does low-confidence flag human?" },
  "h1-screening":           { d:2,c:1,x:1,v:1, status:"sparse", summary:"FP/FN asymmetry drives routing logic." },
  "h1-monitoring":          { d:2,c:2,x:2,v:2, status:"live",   summary:"Statistical control limits as escalation triggers. Westgard adapted to ML." },
  "h1-triage":              { d:4,c:3,x:2,v:3, status:"live",   summary:"Time-critical escalation with defined information package." },
  "h1-treatment":           { d:1,c:0,x:2,v:0, status:"gap",    summary:"No clear examples of treatment escalation protocols in deployed systems." },
  "h1-admin":               { d:1,c:1,x:0,v:1, status:"sparse", summary:"Workflow disruption escalation less studied." },
  // stop (Stop Mechanisms)
  "stop-diagnostic":        { d:5,c:3,x:3,v:4, status:"live",   summary:"Hard stop conditions: data quality failure, confidence below threshold, EHR mismatch." },
  "stop-screening":         { d:3,c:2,x:2,v:2, status:"live",   summary:"Population-level stops vs. individual result suppression." },
  "stop-monitoring":        { d:3,c:1,x:1,v:2, status:"live",   summary:"Automated drift detection triggers." },
  "stop-triage":            { d:2,c:1,x:2,v:1, status:"sparse", summary:"Stop in time-critical context is itself a patient safety event." },
  "stop-treatment":         { d:1,c:0,x:3,v:0, status:"gap",    summary:"Critical gap. No agreed framework for treatment recommendation stops." },
  "stop-admin":             { d:1,c:1,x:0,v:1, status:"sparse", summary:"Ops AI stops create workflow disruption." },
  // watcher (Performance Monitoring & Drift Detection)
  "watcher-diagnostic":     { d:4,c:2,x:1,v:2, status:"live",   summary:"Post-deployment performance tracking. Retrospective accuracy vs. real-time drift." },
  "watcher-screening":      { d:3,c:2,x:1,v:2, status:"live",   summary:"Population shift detection. Subgroup drift." },
  "watcher-monitoring":     { d:2,c:0,x:0,v:1, status:"sparse", summary:"Monitoring of monitoring tools — mostly conceptual." },
  "watcher-triage":         { d:2,c:1,x:1,v:1, status:"sparse", summary:"Triage accuracy monitoring complicated by outcome attribution." },
  "watcher-treatment":      { d:2,c:1,x:2,v:1, status:"sparse", summary:"Clinical outcome tracking. Long attribution chains." },
  "watcher-admin":          { d:1,c:1,x:0,v:0, status:"gap",    summary:"Admin AI monitoring almost undocumented." },
  // h4 (Dispute Resolution Return) → Audit Trails concept
  "h4-diagnostic":          { d:3,c:2,x:0,v:2, status:"live",   summary:"FDA expects documentation of training data lineage." },
  "h4-screening":           { d:2,c:1,x:0,v:1, status:"sparse", summary:"Screening audit aligns mostly with standard EHR documentation." },
  "h4-monitoring":          { d:2,c:0,x:0,v:1, status:"sparse", summary:"Monitoring data as audit artifact." },
  "h4-triage":              { d:2,c:1,x:0,v:1, status:"sparse", summary:"ED triage audit complexity — multiple AI touchpoints." },
  "h4-treatment":           { d:1,c:0,x:1,v:0, status:"gap",    summary:"Treatment recommendation audit: underdeveloped." },
  "h4-admin":               { d:1,c:0,x:0,v:0, status:"gap",    summary:"No standard." },
  // override (Human Oversight & Override Protocols)
  "override-diagnostic":    { d:4,c:3,x:3,v:4, status:"live",   summary:"Clinician override of algorithmic recommendation. Logged? Reviewed? Fed back?" },
  "override-screening":     { d:2,c:1,x:1,v:2, status:"sparse", summary:"Override logic differs when screening is async vs. real-time." },
  "override-monitoring":    { d:2,c:1,x:1,v:1, status:"sparse", summary:"Override of automated monitoring alerts." },
  "override-triage":        { d:3,c:2,x:2,v:3, status:"live",   summary:"Override in time-critical context. Documentation burden vs. speed of care." },
  "override-treatment":     { d:2,c:1,x:3,v:2, status:"sparse", summary:"Highly contested. Most active area of governance debate." },
  "override-admin":         { d:1,c:0,x:0,v:0, status:"gap",    summary:"Admin override tracking largely absent." },
  // validation (Deployment Readiness & Validation)
  "validation-diagnostic":  { d:5,c:3,x:2,v:3, status:"live",   summary:"Clinical + analytical validation, EHR integration testing, FDA clearance." },
  "validation-screening":   { d:4,c:2,x:1,v:2, status:"live",   summary:"Population representativeness. Training-serving skew." },
  "validation-monitoring":  { d:2,c:1,x:0,v:1, status:"sparse", summary:"Validation of monitoring infrastructure itself." },
  "validation-triage":      { d:3,c:2,x:1,v:2, status:"live",   summary:"Prospective vs. retrospective validation for triage tools." },
  "validation-treatment":   { d:2,c:1,x:2,v:1, status:"sparse", summary:"RCT vs. real-world evidence debate." },
  "validation-admin":       { d:1,c:1,x:0,v:1, status:"sparse", summary:"Admin AI validation: no standard framework." },
};

// ─── REAL DOCUMENT LIBRARY ───────────────────────────────────────────────────
// Sources verified as of March 2026. All FDA docs are public domain.
// Academic papers cited with full attribution for reference use.
const DOC_LIBRARY = [
  // ── FDA REGULATORY ──
  {
    id: "fda-pccp-2024",
    title: "Marketing Submission Recommendations for a Predetermined Change Control Plan for AI-Enabled Device Software Functions",
    type: "regulation", source: "FDA", year: "2024",
    url: "https://www.fda.gov/regulatory-information/search-fda-guidance-documents/marketing-submission-recommendations-predetermined-change-control-plan-artificial-intelligence",
    nodes: ["stop","validation","h2","watcher"],
    abstract: "Final guidance (Dec 2024) establishing how manufacturers can pre-authorize future AI model modifications without new 510(k) submissions, provided changes implement exactly as planned. Requires post-market performance monitoring with drift detection triggers and rollback plans.",
  },
  {
    id: "fda-lifecycle-2025",
    title: "AI-Enabled Device Software Functions: Lifecycle Management and Marketing Submission Recommendations",
    type: "regulation", source: "FDA", year: "2025",
    url: "https://www.fda.gov/regulatory-information/search-fda-guidance-documents/artificial-intelligence-enabled-device-software-functions-lifecycle-management-and-marketing",
    nodes: ["validation","watcher","stop","h2"],
    abstract: "Draft guidance (Jan 2025) providing comprehensive lifecycle management approach for AI-enabled devices. Emphasizes continuous post-market monitoring, subgroup performance analysis, and transparency requirements. Addresses training-serving skew and real-world drift as regulatory concerns.",
  },
  {
    id: "fda-transparency-2024",
    title: "Transparency for Machine Learning-Enabled Medical Devices: Guiding Principles",
    type: "regulation", source: "FDA", year: "2024",
    url: "https://www.fda.gov/media/178693/download",
    nodes: ["validation","h4","watcher"],
    abstract: "June 2024 guidance establishing transparency expectations for ML-enabled devices: users must receive clear information about device limitations, intended use, and performance characteristics. Audit trail requirements for training data lineage.",
  },
  {
    id: "fda-gmlp-2021",
    title: "Good Machine Learning Practice for Medical Device Development: Guiding Principles",
    type: "regulation", source: "FDA / Health Canada / MHRA", year: "2021",
    url: "https://www.fda.gov/medical-devices/software-medical-device-samd/good-machine-learning-practice-medical-device-development-guiding-principles",
    nodes: ["validation","watcher","stop","norm"],
    abstract: "Ten principles for ML-based medical device development, co-published by FDA, Health Canada, and UK MHRA. Covers data management, model training, clinical integration, and monitoring. Foundational document for clinical AI governance frameworks.",
  },
  {
    id: "fda-cds-2022",
    title: "Clinical Decision Support Software: Guidance for Industry and FDA Staff",
    type: "regulation", source: "FDA", year: "2022",
    url: "https://www.fda.gov/regulatory-information/search-fda-guidance-documents/clinical-decision-support-software",
    nodes: ["authority","stop","validation","h2"],
    abstract: "Defines which clinical decision support software is excluded from FDA device regulation under 21st Century Cures Act. Key for authority matrix: tools that display information for clinician interpretation vs. tools that replace clinical judgment have different regulatory — and governance — requirements.",
  },
  // ── AUTOMATION BIAS & OVERRIDE ──
  {
    id: "khera-jama-2023",
    title: "Automation Bias and Assistive AI: Risk of Harm From AI-Driven Clinical Decision Support",
    type: "peer-reviewed", source: "JAMA", year: "2023",
    url: "https://pubmed.ncbi.nlm.nih.gov/38112824/",
    nodes: ["override","stop","watcher"],
    abstract: "Khera, Simon & Ross (Yale/Northwestern). Argues current FDA evaluation focuses on model performance across populations but does not capture downstream consequences when clinicians defer to AI over their own judgment. Errors from automation bias are compounded by time pressure. Direct implication: override logging and rate monitoring are patient safety infrastructure, not optional quality metrics.",
  },
  {
    id: "goddard-jamia-2011",
    title: "Automation Bias: A Systematic Review of Frequency, Effect Mediators, and Mitigators",
    type: "peer-reviewed", source: "JAMIA", year: "2011",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3240751/",
    nodes: ["override","watcher"],
    abstract: "Goddard, Roudsari & Wyatt. Foundational systematic review establishing automation bias as a measurable, predictable phenomenon in clinical decision support. Key finding: overall performance improves with CDSS use, but CDSS introduces new error types that are systematically missed. Override design must account for both under-reliance and over-reliance failure modes.",
  },
  // ── STOP MECHANISMS / ECG GOVERNANCE ──
  {
    id: "guvenc-ecg-2025",
    title: "ECG Arrhythmia Detection Governance Demo: Stop Mechanism Implementation with MIMIC-IV",
    type: "practitioner", source: "Lindsay LaMere Guvenc / GitHub", year: "2025",
    url: "https://github.com/lindsayguvenc-coder/ecg-governance-demo",
    nodes: ["stop","validation","watcher"],
    abstract: "Concrete implementation of a governance framework for ECG arrhythmia detection AI using MIMIC-IV data. Demonstrates Westgard-adapted stop thresholds, authority matrix for hard stop activation, and escalation protocol design. The only publicly available example of CLIA QC principles applied to AI inference monitoring in a clinical diagnostic aid context.",
  },
  {
    id: "westgard-ml-adaptation",
    title: "Westgard Multi-Rule Framework Adapted for ML Inference Monitoring: QC Principles for Clinical AI",
    type: "practitioner", source: "Lindsay LaMere Guvenc / Governance Commons", year: "2025",
    url: null,
    nodes: ["stop","watcher","h1"],
    abstract: "Translation of Westgard 2-of-3s, 4-1s, and 10-x rules from laboratory QC into ML inference monitoring context. Core argument: whoever signs the corrective action owns the governance decision — authority follows existing accountability structures rather than creating new ones. Addresses the fixed vs. adaptive threshold debate by proposing population-stratified control limits as a bridge position.",
  },
  // ── IHI PATIENT SAFETY ──
  {
    id: "ihi-leape-2024",
    title: "Bringing Safety to AI: Adapting Patient Safety Principles to Artificial Intelligence in Health Care",
    type: "guideline", source: "IHI / Lucian Leape Institute", year: "2024",
    url: "https://www.ihi.org/resources/white-papers/bringing-safety-ai-adapting-patient-safety-principles-artificial-intelligence-health-care",
    nodes: ["stop","authority","escalation","h1"],
    abstract: "IHI framework applying established patient safety principles (Just Culture, high reliability, safety I/II) to clinical AI deployment. Argues that AI governance requires the same structural elements as patient safety programs: clear authority, non-punitive error reporting, stop mechanisms, and prospective hazard analysis. Most directly applicable to stop mechanism and authority tier design.",
  },
  // ── AUTHORITY / GOVERNANCE FRAMEWORKS ──
  {
    id: "haip-principles-2024",
    title: "Health AI Partnership: Principles for Responsible AI Governance in Health Systems",
    type: "guideline", source: "HAIP", year: "2024",
    url: "https://healthaipartnership.org",
    nodes: ["authority","commons","h2"],
    abstract: "Multi-stakeholder framework (academic medical centers, payers, vendors) for health AI governance. Establishes principle that governance authority must be pre-assigned before deployment, not negotiated after an incident. Recommends tiered authority structure from advisory to suspension.",
  },
  {
    id: "ama-ai-policy-2023",
    title: "Augmented Intelligence in Medicine: AMA Policy and Principles",
    type: "guideline", source: "AMA", year: "2023",
    url: "https://www.ama-assn.org/practice-management/digital/ama-principles-augmented-intelligence-medicine",
    nodes: ["authority","override","validation"],
    abstract: "AMA policy framework for physician-AI interaction. Key governance principle: AI systems must support physician decision-making authority, not replace it. Explicit on override rights and documentation requirements. Distinguishes between decision support (physician retains authority) and autonomous AI (different governance regime).",
  },
  // ── MONITORING & DRIFT ──
  {
    id: "haug-nejm-2023",
    title: "Artificial Intelligence and Machine Learning in Clinical Medicine, 2023",
    type: "peer-reviewed", source: "NEJM", year: "2023",
    url: "https://www.nejm.org/doi/10.1056/NEJMra2302038",
    nodes: ["watcher","validation","stop"],
    abstract: "Haug & Drazen review of clinical AI state of evidence. Addresses the gap between model performance in validation studies and real-world deployment performance. Key for monitoring node: retrospective validation accuracy does not predict post-deployment drift. Establishes the case for continuous monitoring as a governance requirement, not a nice-to-have.",
  },
  {
    id: "apollo-2024",
    title: "AI Behind Closed Doors: Evaluating AI Systems in Deployment",
    type: "report", source: "Apollo Research", year: "2024",
    url: "https://apolloresearch.ai",
    nodes: ["watcher","commons","stop"],
    abstract: "Apollo Research evaluation framework for deployed AI systems. Documents the structural gap between how AI systems behave in controlled evaluations vs. real-world deployment. Directly relevant to watcher layer design: monitoring must account for behavioral drift under distribution shift, not just performance drift on held-out test sets.",
  },
];

// ─── CHAT THREADS (real, attributed) ────────────────────────────────────────
const CHAT_THREADS = {
  stop: [
    {
      author: "Lindsay LaMere Guvenc · CLS II / AI Governance",
      time: "Mar 2025",
      text: "The QC threshold problem in clinical AI is structurally identical to Westgard multi-rule design. The 2-of-3s rule maps directly to: if 2 of 3 consecutive inference confidence scores fall below threshold, escalate. The 4-1s maps to sustained drift. We don't need new frameworks — we need to translate the ones that already work.",
      gem: true,
    },
    {
      author: "Lindsay LaMere Guvenc · CLS II / AI Governance",
      time: "Mar 2025",
      text: "Key unresolved: Westgard rules assume calibrated, comparable measurements from a stable analytic process. ML confidence scores are not that — they're model-specific, not cross-vendor comparable, and can shift with data distribution. The adaptation works conceptually but requires per-deployment calibration first. That calibration step is currently missing from every deployment checklist I've seen.",
      gem: false,
    },
    {
      author: "Lindsay LaMere Guvenc · CLS II / AI Governance",
      time: "Mar 2025",
      text: "From the ECG governance demo: the hard stop fired twice in retrospective MIMIC-IV validation — both on data quality failures (missing lead configurations), not model confidence failures. Implication: data validation stops may be more practically important than confidence threshold stops, at least for diagnostic aid tools. Worth separating these in the stop condition registry.",
      gem: true,
    },
  ],
  h2: [
    {
      author: "Lindsay LaMere Guvenc · CLS II / AI Governance",
      time: "Feb 2025",
      text: "The authority problem in clinical AI has a direct analog in laboratory medicine. Under CLIA, the laboratory director holds corrective action authority — full stop, regardless of what the instrument vendor or the hospital administration wants. The principle that works: authority follows existing accountability structures. Whoever already owns corrective action in your governance system should own AI governance authority for that domain.",
      gem: true,
    },
    {
      author: "Lindsay LaMere Guvenc · CLS II / AI Governance",
      time: "Feb 2025",
      text: "The gap I keep finding: institutions build AI governance committees but don't pre-assign who has Tier 3 (suspend) and Tier 4 (terminate) authority. Everyone agrees those tiers should exist. Nobody wants to put a name on them before something goes wrong. That reluctance is itself a governance failure — and it's the most common one.",
      gem: false,
    },
  ],
  override: [
    {
      author: "Lindsay LaMere Guvenc · CLS II / AI Governance",
      time: "Jan 2025",
      text: "Khera et al (JAMA 2023) frames this well: automation bias errors are compounded by time pressure. This means override design in high-acuity settings (ED triage, ICU monitoring) has to account for the fact that the clinical environment itself reduces the cognitive bandwidth available to question the AI. Override needs to be nearly frictionless in those contexts — the governance cost shifts to the review cycle, not the point of care.",
      gem: true,
    },
  ],
  watcher: [
    {
      author: "Lindsay LaMere Guvenc · CLS II / AI Governance",
      time: "Feb 2025",
      text: "The monitoring gap that nobody talks about: each vendor monitors their own model's performance. The institution has no independent view. This is like letting the instrument manufacturer run your QC program. It would never pass a CAP inspection. The watcher layer is the institution's independent monitoring infrastructure — it has to exist outside the vendor relationship.",
      gem: true,
    },
  ],
  commons: [
    {
      author: "Lindsay LaMere Guvenc · CLS II / AI Governance",
      time: "Mar 2025",
      text: "This tool is the prototype for what the commons could look like. The gap it fills: everyone is producing governance documents. Nobody has built the connective tissue that makes them findable, relatable, and usable in context. The map is the artifact.",
      gem: true,
    },
  ],
};

// ─── AI NODE CONTEXT (sent to API for synthesis) ────────────────────────────
// Each entry provides structured context for the Claude synthesis call.
// In production, the API call receives this plus linked doc abstracts.
const NODE_CONTEXT = {
  stop: {
    keyDocs: ["fda-pccp-2024","fda-gmlp-2021","guvenc-ecg-2025","westgard-ml-adaptation","ihi-leape-2024"],
    keyInsight: "Only deployed example of Westgard-adapted stop thresholds in clinical AI is the ECG governance demo. Fixed vs. adaptive threshold debate unresolved in the literature.",
  },
  h2: {
    keyDocs: ["fda-cds-2022","haip-principles-2024","ama-ai-policy-2023","fda-pccp-2024"],
    keyInsight: "Authority follows accountability. CLIA lab director model is the closest existing analog to what clinical AI authority structure should look like.",
  },
  override: {
    keyDocs: ["khera-jama-2023","goddard-jamia-2011","ama-ai-policy-2023"],
    keyInsight: "Automation bias is a predictable system behavior, not a user failure. Override design must account for both over-reliance (too easy) and under-reliance (too hard) failure modes.",
  },
  watcher: {
    keyDocs: ["fda-pccp-2024","fda-lifecycle-2025","haug-nejm-2023","apollo-2024","guvenc-ecg-2025"],
    keyInsight: "Institutional independent monitoring is structurally absent. Vendor self-monitoring is insufficient — analogous to instrument manufacturers running QC programs.",
  },
  validation: {
    keyDocs: ["fda-lifecycle-2025","fda-gmlp-2021","fda-transparency-2024","fda-pccp-2024"],
    keyInsight: "Training-serving skew is the key validation gap. Retrospective accuracy does not predict post-deployment drift. FDA now requires continuous monitoring as part of the validation regime.",
  },
  commons: {
    keyDocs: ["haip-principles-2024","apollo-2024","ihi-leape-2024"],
    keyInsight: "The commons does not exist. This tool is the prototype. The structural gap: no neutral institutional authority owns the schema, threshold registry, or taxonomy for healthcare AI governance.",
  },
};

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function LoopPill({ loop, small }) {
  const m = LOOP_META[loop];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: small ? "2px 6px" : "3px 8px",
      background: m.color + "15",
      border: `1px solid ${m.color}33`,
      borderRadius: 3,
      fontFamily: C.mono,
      fontSize: small ? 9 : 10,
      color: m.color,
      fontWeight: 700,
      letterSpacing: "0.06em",
      whiteSpace: "nowrap",
    }}>{m.label.toUpperCase()}</span>
  );
}

function StatusDot({ status }) {
  const colors = { live: C.external, sparse: C.handoff, gap: C.textDimmer };
  return (
    <span style={{
      display: "inline-block", width: 6, height: 6, borderRadius: "50%",
      background: colors[status] || C.textDimmer,
      boxShadow: status === "live" ? `0 0 5px ${C.external}` : "none",
    }}/>
  );
}

// ─── LAYER 1: DOC REPOSITORY VIEW ────────────────────────────────────────────
function DocRepository({ onNavigate }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [expanded, setExpanded] = useState(null);
  const [publicDocs, setPublicDocs] = useState([]);

  useEffect(() => {
    fetch("/api/documents?scope=public")
      .then(r => r.ok ? r.json() : { documents: [] })
      .then(data => setPublicDocs(data.documents || []))
      .catch(() => {});
  }, []);

  const allDocs = [
    ...DOC_LIBRARY,
    ...publicDocs.map(d => ({
      ...d,
      id: d.id || `promoted-${d.title?.slice(0,20)}`,
      nodes: d.suggestedNodes || [],
      promoted: true,
    })),
  ];

  const typeColors = {
    regulation: C.red, preprint: C.commons, guideline: C.internal,
    "peer-reviewed": C.internal, case: C.handoff, report: C.external,
    practitioner: C.handoff,
  };

  const filtered = allDocs.filter(d => {
    const matchSearch = !search || d.title.toLowerCase().includes(search.toLowerCase()) || d.source.toLowerCase().includes(search.toLowerCase()) || (d.abstract || "").toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || d.type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div style={{ padding: "20px 24px" }}>
      <div style={{ marginBottom: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search documents, sources, abstracts…"
          style={{
            flex: 1, minWidth: 200,
            background: C.surface2, border: `1px solid ${C.border}`,
            borderRadius: 4, padding: "7px 12px",
            color: C.text, fontFamily: C.mono, fontSize: 12,
            outline: "none",
          }}
        />
        {["all","regulation","peer-reviewed","guideline","practitioner","report"].map(t => (
          <button key={t} onClick={() => setTypeFilter(t)} style={{
            padding: "5px 10px", borderRadius: 3, cursor: "pointer", fontFamily: C.mono, fontSize: 10,
            fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
            background: typeFilter === t ? (typeColors[t] || C.commons) + "20" : "transparent",
            border: `1px solid ${typeFilter === t ? (typeColors[t] || C.commons) + "60" : C.border}`,
            color: typeFilter === t ? (typeColors[t] || C.commons) : C.textDim,
          }}>{t}</button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {filtered.map((doc) => {
          const isExp = expanded === doc.id;
          return (
            <div key={doc.id} style={{
              background: C.surface2, border: `1px solid ${isExp ? C.borderBright : C.border}`,
              borderRadius: 5, overflow: "hidden",
              transition: "border-color 0.12s",
            }}>
              <div
                style={{ padding: "10px 14px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, cursor: "pointer" }}
                onClick={() => setExpanded(isExp ? null : doc.id)}
                onMouseEnter={e => e.currentTarget.parentElement.style.borderColor = C.borderBright}
                onMouseLeave={e => { if (!isExp) e.currentTarget.parentElement.style.borderColor = C.border; }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{
                      padding: "2px 6px", borderRadius: 2,
                      background: (typeColors[doc.type] || C.textDim) + "18",
                      border: `1px solid ${(typeColors[doc.type] || C.textDim)}33`,
                      color: typeColors[doc.type] || C.textDim,
                      fontFamily: C.mono, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
                    }}>{doc.type.toUpperCase()}</span>
                    <span style={{ fontFamily: C.mono, fontSize: 10, color: C.textDim }}>{doc.source} · {doc.year}</span>
                  </div>
                  <div style={{ fontSize: 13, color: C.text, lineHeight: 1.4 }}>{doc.title}</div>
                </div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {doc.nodes.map(nid => {
                    const node = TAXONOMY_NODES.find(n => n.id === nid);
                    if (!node) return null;
                    return (
                      <button key={nid} onClick={e => { e.stopPropagation(); onNavigate("taxonomy", nid); }} style={{
                        padding: "2px 7px", borderRadius: 3, cursor: "pointer",
                        background: LOOP_META[node.loop].color + "10",
                        border: `1px solid ${LOOP_META[node.loop].color}30`,
                        color: LOOP_META[node.loop].color,
                        fontFamily: C.mono, fontSize: 9, fontWeight: 600,
                      }}>{node.icon} {node.label}</button>
                    );
                  })}
                </div>
              </div>
              {isExp && (
                <div style={{ padding: "0 14px 12px", borderTop: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.7, marginTop: 10, marginBottom: 8 }}>
                    {doc.abstract}
                  </div>
                  {doc.url && (
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{
                      fontFamily: C.mono, fontSize: 10, color: C.internal, textDecoration: "none",
                    }}>↗ Open source →</a>
                  )}
                  {!doc.url && (
                    <span style={{ fontFamily: C.mono, fontSize: 10, color: C.textDimmer }}>Internal document — no external URL</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 12, fontFamily: C.mono, fontSize: 10, color: C.textDimmer }}>
        {filtered.length} of {DOC_LIBRARY.length} documents · click any document to expand abstract and source link
      </div>
    </div>
  );
}

// ─── LAYER 2: TAXONOMY NAVIGATOR ─────────────────────────────────────────────
function TaxonomyNavigator({ activeNodeId, onSelectNode, loopFilter }) {
  const grouped = ["internal","handoff","external","commons"].map(loop => ({
    loop,
    nodes: TAXONOMY_NODES.filter(n => n.loop === loop && (loopFilter === "all" || loopFilter === loop)),
  })).filter(g => g.nodes.length > 0);

  return (
    <div style={{ padding: "0 0 20px" }}>
      {grouped.map(({ loop, nodes }) => {
        const lm = LOOP_META[loop];
        return (
          <div key={loop} style={{ marginBottom: 4 }}>
            <div style={{
              padding: "8px 20px", display: "flex", alignItems: "center", gap: 8,
              borderBottom: `1px solid ${lm.color}20`,
            }}>
              <div style={{ width: 2, height: 14, background: lm.color, borderRadius: 1 }}/>
              <span style={{ fontFamily: C.mono, fontSize: 10, color: lm.color, fontWeight: 700, letterSpacing: "0.1em" }}>
                {lm.label.toUpperCase()}
              </span>
              <span style={{ fontFamily: C.mono, fontSize: 10, color: C.textDimmer }}>— {lm.question}</span>
            </div>
            {nodes.map(node => (
              <div key={node.id}
                onClick={() => onSelectNode(node.id)}
                style={{
                  padding: "9px 20px 9px 28px",
                  cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 10,
                  borderLeft: `2px solid ${activeNodeId === node.id ? lm.color : "transparent"}`,
                  background: activeNodeId === node.id ? lm.color + "08" : "transparent",
                  transition: "all 0.12s",
                }}
                onMouseEnter={e => { if (activeNodeId !== node.id) e.currentTarget.style.background = C.surface2; }}
                onMouseLeave={e => { if (activeNodeId !== node.id) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontFamily: C.mono, fontSize: 13, color: lm.color, opacity: 0.7, width: 16 }}>{node.icon}</span>
                <span style={{ fontSize: 12.5, color: activeNodeId === node.id ? C.text : C.textDim, fontWeight: activeNodeId === node.id ? 500 : 400, flex: 1 }}>
                  {node.label}
                </span>
                <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
                  {node.matrixReady && (
                    <span style={{ fontFamily: C.mono, fontSize: 8, color: C.external, background: C.externalDim, border: `1px solid ${C.external}30`, borderRadius: 2, padding: "1px 5px", letterSpacing: "0.04em" }}>↗ MATRIX</span>
                  )}
                  {!node.mandatory && (
                    <span style={{ fontFamily: C.mono, fontSize: 8, color: C.textDimmer }}>opt</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ─── LAYER 3: AI CURATION PANEL ──────────────────────────────────────────────
function AICurationPanel({ node }) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [lastGenerated, setLastGenerated] = useState(null);

  const lm = LOOP_META[node.loop];
  const ctx = NODE_CONTEXT[node.id];

  // Build context string from linked doc abstracts
  const buildContext = () => {
    const linkedDocs = ctx
      ? DOC_LIBRARY.filter(d => ctx.keyDocs.includes(d.id))
      : DOC_LIBRARY.filter(d => d.nodes.includes(node.id));

    const docContext = linkedDocs.map(d =>
      `[${d.type.toUpperCase()} · ${d.source} ${d.year}]\n${d.title}\n${d.abstract}`
    ).join("\n\n");

    const chatGems = (CHAT_THREADS[node.id] || [])
      .filter(m => m.gem)
      .map(m => `[PRACTITIONER INSIGHT · ${m.author}]\n${m.text}`)
      .join("\n\n");

    return `NODE: ${node.label}
LOOP: ${lm.label} — ${lm.question}
GOVERNANCE QUESTION: ${node.question}
KNOWN CONTENTION: ${node.contention}
KNOWN GAP: ${node.gap}
KEY INSIGHT: ${ctx?.keyInsight || "None documented yet."}

LINKED DOCUMENTS:
${docContext || "No documents linked yet."}

PRACTITIONER GEMS FROM CONVERSATION:
${chatGems || "None yet."}`;
  };

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    setSummary(null);

    try {
      const context = buildContext();
      const res = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are an AI curation assistant for a clinical AI governance commons. Your job is to synthesize governance documentation for a specific node in the governance framework.

Write a synthesis of 3-4 paragraphs that:
1. States what the field has converged on (if anything) at this node
2. Identifies the primary points of genuine contention — where credible sources disagree
3. Names the most important gap — what governance infrastructure is missing or underdeveloped
4. Notes any practitioner insights that are particularly valuable or novel

Be direct and specific. Avoid generic statements about "the importance of governance." Name the actual problems. If a practitioner insight from conversation is genuinely novel, say so explicitly. Write for an audience of clinical operations leaders and healthcare AI governance professionals.`,
          messages: [{
            role: "user",
            content: `Please synthesize the governance documentation for this commons node:\n\n${context}`,
          }],
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `API error ${res.status}`);
      }

      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text;
      if (!text) throw new Error("No text in response");

      setSummary(text);
      setLastGenerated(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ borderTop: `1px solid ${C.border}`, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontFamily: C.mono, fontSize: 10, color: C.commons, fontWeight: 700, letterSpacing: "0.1em" }}>
            ◉ AI CURATION
          </span>
          {lastGenerated && (
            <span style={{ fontFamily: C.mono, fontSize: 9, color: C.textDimmer }}>generated {lastGenerated}</span>
          )}
        </div>
        <button onClick={handleRefresh} disabled={loading} style={{
          padding: "3px 9px", borderRadius: 3, cursor: loading ? "not-allowed" : "pointer",
          background: loading ? C.surface3 : C.commonsDim,
          border: `1px solid ${C.commons}30`,
          color: loading ? C.textDimmer : C.commons,
          fontFamily: C.mono, fontSize: 9, fontWeight: 700,
        }}>
          {loading ? "synthesizing…" : summary ? "↺ regenerate" : "◉ synthesize"}
        </button>
      </div>

      {loading && (
        <div style={{ fontFamily: C.mono, fontSize: 11, color: C.textDimmer, fontStyle: "italic", lineHeight: 1.7 }}>
          Scanning {DOC_LIBRARY.filter(d => d.nodes.includes(node.id)).length} documents,
          surfacing contention, checking for gaps…
        </div>
      )}

      {error && (
        <div style={{ padding: "8px 10px", background: C.redDim, border: `1px solid ${C.red}30`, borderRadius: 4, fontFamily: C.mono, fontSize: 10, color: C.red, marginBottom: 8 }}>
          API error: {error}
          {error.includes("401") && " — check API key in browser console"}
        </div>
      )}

      {!loading && summary && (
        <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.75, borderLeft: `2px solid ${C.commons}40`, paddingLeft: 10, whiteSpace: "pre-wrap" }}>
          {summary}
        </div>
      )}

      {!loading && !summary && !error && (
        <div style={{ fontFamily: C.mono, fontSize: 11, color: C.textDimmer, lineHeight: 1.6 }}>
          Click "◉ synthesize" to generate a real-time AI synthesis of the {DOC_LIBRARY.filter(d => d.nodes.includes(node.id)).length} documents linked to this node.
        </div>
      )}

      {/* Points of contention */}
      <div style={{ marginTop: 12, padding: "8px 10px", background: C.handoffDim, border: `1px solid ${C.handoff}25`, borderRadius: 4 }}>
        <div style={{ fontFamily: C.mono, fontSize: 9, color: C.handoff, fontWeight: 700, marginBottom: 4, letterSpacing: "0.08em" }}>⚡ KNOWN CONTENTION</div>
        <div style={{ fontSize: 11.5, color: C.textDim, lineHeight: 1.5 }}>{node.contention}</div>
      </div>

      {/* Gap */}
      <div style={{ marginTop: 6, padding: "8px 10px", background: C.redDim, border: `1px solid ${C.red}25`, borderRadius: 4 }}>
        <div style={{ fontFamily: C.mono, fontSize: 9, color: C.red, fontWeight: 700, marginBottom: 4, letterSpacing: "0.08em" }}>⬜ KNOWN GAP</div>
        <div style={{ fontSize: 11.5, color: C.textDim, lineHeight: 1.5 }}>{node.gap}</div>
      </div>
    </div>
  );
}

// ─── LAYER 4: COLLABORATIVE CHAT ─────────────────────────────────────────────
function CollabChat({ node }) {
  const [messages, setMessages] = useState(CHAT_THREADS[node.id] || []);
  const [input, setInput] = useState("");
  const [author, setAuthor] = useState("You");
  const endRef = useRef(null);

  const lm = LOOP_META[node.loop];

  const convPrompts = {
    stop: "What should trigger an automated stop for this tool, and who needs to be in the room when you define that threshold?",
    authority: "Who in your organization actually has authority to say 'this AI tool goes live' — and who should?",
    h1: "What response window is actually operationally achievable for a hot-trigger escalation at your institution?",
    watcher: "How do you validate that your monitoring thresholds are appropriate for your specific patient population?",
    commons: "What would it take to convince your institution to contribute governance documents to a shared commons?",
  };

  const prompt = convPrompts[node.id] || `How does your institution handle: ${node.question}`;

  const send = () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, { author: author || "Anonymous", time: "now", text: input.trim(), gem: false }]);
    setInput("");
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  return (
    <div style={{ borderTop: `1px solid ${C.border}`, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "12px 16px 8px", display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ fontFamily: C.mono, fontSize: 10, color: "#c084fc", fontWeight: 700, letterSpacing: "0.1em" }}>◈ NODE CONVERSATION</span>
      </div>

      <div style={{ margin: "0 16px 10px", padding: "9px 12px", background: "#c084fc10", border: "1px solid #c084fc25", borderRadius: 4, fontSize: 12, color: C.textDim, fontStyle: "italic", lineHeight: 1.5 }}>
        {prompt}
      </div>

      <div style={{ maxHeight: 200, overflowY: "auto", padding: "0 16px" }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
              <span style={{ fontFamily: C.mono, fontSize: 10, color: lm.color }}>{m.author}</span>
              <span style={{ fontFamily: C.mono, fontSize: 9, color: C.textDimmer }}>{m.time}</span>
              {m.gem && (
                <span style={{
                  padding: "1px 6px", borderRadius: 2,
                  background: C.handoff + "20", border: `1px solid ${C.handoff}40`,
                  fontFamily: C.mono, fontSize: 8, color: C.handoff, fontWeight: 700,
                }}>💎 GEM → NODE SUMMARY</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: m.gem ? C.text : C.textDim, lineHeight: 1.5 }}>{m.text}</div>
          </div>
        ))}
        <div ref={endRef}/>
      </div>

      <div style={{ padding: "8px 16px 14px", display: "flex", gap: 6 }}>
        <input
          value={author}
          onChange={e => setAuthor(e.target.value)}
          placeholder="Your name + role"
          style={{
            width: 140, background: C.surface3, border: `1px solid ${C.border}`,
            borderRadius: 3, padding: "6px 8px", color: C.textDim,
            fontFamily: C.mono, fontSize: 10, outline: "none",
          }}
        />
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Add to this conversation…"
          style={{
            flex: 1, background: C.surface3, border: `1px solid ${C.border}`,
            borderRadius: 3, padding: "6px 10px", color: C.text,
            fontFamily: C.mono, fontSize: 11, outline: "none",
          }}
        />
        <button onClick={send} style={{
          padding: "6px 12px", borderRadius: 3, cursor: "pointer",
          background: "#c084fc20", border: "1px solid #c084fc40",
          color: "#c084fc", fontFamily: C.mono, fontSize: 10, fontWeight: 700,
        }}>Send</button>
      </div>
    </div>
  );
}

// ─── MATRIX BRIDGE ───────────────────────────────────────────────────────────
function MatrixBridge({ linkedConcept }) {
  const [activeConcept, setActiveConcept] = useState(linkedConcept || MATRIX_CONCEPTS[2].id);
  const [activeUseCase, setActiveUseCase] = useState("diagnostic");

  return (
    <div style={{ padding: "16px 20px" }}>
      <div style={{ fontFamily: C.mono, fontSize: 10, color: C.textDimmer, letterSpacing: "0.08em", marginBottom: 10 }}>
        GOVERNANCE COMMONS MATRIX — use case × concept
      </div>

      {/* Concept selector */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
        {MATRIX_CONCEPTS.map(c => (
          <button key={c.id} onClick={() => setActiveConcept(c.id)} style={{
            padding: "4px 9px", borderRadius: 3, cursor: "pointer",
            background: activeConcept === c.id ? C.external + "20" : "transparent",
            border: `1px solid ${activeConcept === c.id ? C.external + "60" : C.border}`,
            color: activeConcept === c.id ? C.external : C.textDim,
            fontFamily: C.mono, fontSize: 10, fontWeight: activeConcept === c.id ? 700 : 400,
          }}>{c.icon} {c.label.split(" ")[0]}</button>
        ))}
      </div>

      {/* Use case row */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {MATRIX_USECASES.map(uc => {
          const key = `${activeConcept}-${uc.id}`;
          const cell = MATRIX_CELLS[key];
          const isActive = activeUseCase === uc.id;
          return (
            <div key={uc.id} onClick={() => setActiveUseCase(uc.id)} style={{
              flex: 1, minWidth: 80, padding: "8px 6px",
              background: isActive ? C.external + "12" : C.surface2,
              border: `1px solid ${isActive ? C.external : C.border}`,
              borderRadius: 4, cursor: "pointer", transition: "all 0.12s",
              textAlign: "center",
            }}>
              <div style={{ fontFamily: C.mono, fontSize: 9, color: isActive ? C.external : C.textDim, marginBottom: 5 }}>{uc.label}</div>
              {cell && (
                <>
                  <div style={{ display: "flex", justifyContent: "center", gap: 2, marginBottom: 4, flexWrap: "wrap" }}>
                    {Array(Math.min(cell.d,3)).fill(0).map((_,i) => <span key={i} style={{ width:5, height:5, borderRadius:"50%", background: C.internal, opacity:0.7, display:"inline-block" }}/>)}
                    {Array(Math.min(cell.c,2)).fill(0).map((_,i) => <span key={i} style={{ width:5, height:5, borderRadius:"50%", background: C.handoff, opacity:0.7, display:"inline-block" }}/>)}
                    {Array(Math.min(cell.x,2)).fill(0).map((_,i) => <span key={i} style={{ width:5, height:5, borderRadius:"50%", background: C.red, opacity:0.7, display:"inline-block" }}/>)}
                  </div>
                  <StatusDot status={cell.status}/>
                </>
              )}
              {!cell && <span style={{ fontFamily: C.mono, fontSize: 9, color: C.textDimmer }}>—</span>}
            </div>
          );
        })}
      </div>

      {/* Selected cell detail */}
      {(() => {
        const key = `${activeConcept}-${activeUseCase}`;
        const cell = MATRIX_CELLS[key];
        const concept = MATRIX_CONCEPTS.find(c => c.id === activeConcept);
        const uc = MATRIX_USECASES.find(u => u.id === activeUseCase);
        if (!cell) return (
          <div style={{ padding: "10px", background: C.redDim, border: `1px solid ${C.red}25`, borderRadius: 4, fontFamily: C.mono, fontSize: 11, color: C.red }}>
            ⬜ Governance gap — no documented infrastructure at this node
          </div>
        );
        return (
          <div style={{ padding: "10px 12px", background: C.surface3, border: `1px solid ${C.border}`, borderRadius: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontFamily: C.mono, fontSize: 10, color: C.external, fontWeight: 700 }}>{concept?.icon} {concept?.label}</span>
              <span style={{ fontFamily: C.mono, fontSize: 10, color: C.textDimmer }}>×</span>
              <span style={{ fontFamily: C.mono, fontSize: 10, color: C.external }}>{uc?.label}</span>
              <StatusDot status={cell.status}/>
              <span style={{ fontFamily: C.mono, fontSize: 9, color: C.textDimmer, marginLeft: 4 }}>{cell.status}</span>
            </div>
            <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.5, marginBottom: 8 }}>{cell.summary}</div>
            <div style={{ display: "flex", gap: 10 }}>
              {[["docs", cell.d, C.internal], ["cases", cell.c, C.handoff], ["contested", cell.x, C.red], ["threads", cell.v, "#c084fc"]].map(([label, count, color]) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: C.mono, fontSize: 14, color, fontWeight: 700 }}>{count}</div>
                  <div style={{ fontFamily: C.mono, fontSize: 9, color: C.textDimmer }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── FACETIOUS COLLABORATOR ──────────────────────────────────────────────────
const ROLES = [
  {
    id: "clin-ops",
    label: "Clinical Ops",
    icon: "🏥",
    voice: "Operational realist. Has been handed frameworks that looked great on paper and failed on the floor. Asks about coverage, workflows, and what happens at 2am.",
    color: "#38bdf8",
  },
  {
    id: "clinician",
    label: "Clinician",
    icon: "🩺",
    voice: "Point-of-care practitioner. Skeptical of anything that adds cognitive load during high-acuity moments. Asks whether the AI output is actually usable in context and who's responsible when they disagree with it.",
    color: "#10b981",
  },
  {
    id: "patient",
    label: "Patient",
    icon: "🧑",
    voice: "The person the system is ostensibly for. Asks whether they were consulted, whether they can opt out, what happens if the algorithm is wrong about them, and who they talk to.",
    color: "#c084fc",
  },
  {
    id: "compliance",
    label: "Compliance / Legal",
    icon: "⚖️",
    voice: "Liability-focused. Asks about documentation trails, regulatory exposure, what happens when a decision is challenged post-incident, and whether any of this has been through legal review.",
    color: "#f59e0b",
  },
  {
    id: "risk",
    label: "Risk",
    icon: "🛡️",
    voice: "Enterprise risk manager. Asks about failure modes, insurance implications, what the institution's exposure is if this goes wrong, and whether risk has formally signed off.",
    color: "#f43f5e",
  },
  {
    id: "patient-safety",
    label: "Patient Safety",
    icon: "🔒",
    voice: "Quality and safety officer. Asks what the harm profile looks like, whether near-misses will be captured, and whether there's a reporting pathway when the AI contributes to an adverse event.",
    color: "#fb923c",
  },
  {
    id: "exec",
    label: "Executive Leadership",
    icon: "📊",
    voice: "C-suite or VP level. Asks about strategic rationale, resource requirements, who owns this long-term, and what the institution is committing to when it deploys this.",
    color: "#e879f9",
  },
  {
    id: "vendor",
    label: "Vendor",
    icon: "🏢",
    voice: "The AI system's vendor. Asks what the institution is actually responsible for versus what they cover, what contract terms govern governance obligations, and whether the institution's requirements are technically feasible.",
    color: "#94a3b8",
  },
  {
    id: "ai-eng",
    label: "AI Engineering",
    icon: "🧠",
    voice: "ML engineer or data scientist. Asks whether the model was validated on this population, whether the confidence scores are calibrated, what distribution shift looks like, and who owns retraining.",
    color: "#67e8f9",
  },
  {
    id: "enterprise-it",
    label: "Enterprise IT",
    icon: "🖧",
    voice: "Infrastructure and integration owner. Asks how this connects to the EHR, who owns the integration when it breaks, whether this is on the approved vendor list, and what the downtime protocol is.",
    color: "#86efac",
  },
  {
    id: "ethics",
    label: "Ethics",
    icon: "◎",
    voice: "Clinical or organizational ethicist. Asks who benefits from this deployment, who bears the cost if it's wrong, whether equity implications have been assessed, and under what conditions the institution should stop even if performance metrics look fine.",
    color: "#fde68a",
  },
];

function FacetiousCollaborator({ node }) {
  const [activeRole, setActiveRole] = useState(ROLES[0].id);
  const [loading, setLoading] = useState(false);
  const [responses, setResponses] = useState({});
  const [error, setError] = useState(null);

  const role = ROLES.find(r => r.id === activeRole);
  const currentResponse = responses[`${node.id}-${activeRole}`];

  const linkedDocs = DOC_LIBRARY.filter(d => d.nodes.includes(node.id));

  const handleGenerate = async () => {
    const key = `${node.id}-${activeRole}`;
    setLoading(true);
    setError(null);

    const docContext = linkedDocs.map(d => `- ${d.title} (${d.source}, ${d.year}): ${d.abstract}`).join("\n");

    try {
      const res = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are a governance dissenter playing the role of: ${role.label}.

Voice profile: ${role.voice}

Your job is NOT to be supportive or comprehensive. Your job is to ask the 3-5 most uncomfortable questions this role would ask about this governance node — the ones that usually don't get asked in the room, or that get smoothed over. Be specific, direct, and role-accurate. No preamble. No "great framework!" Just the questions this person would actually ask, in the voice they would actually use.

Format: A short sharp intro sentence (what this role cares about at this node), then 3-5 numbered questions. Each question should be 1-2 sentences. Don't soften them.`,
          messages: [{
            role: "user",
            content: `GOVERNANCE NODE: ${node.label}
Core question: ${node.question}
Known contention: ${node.contention}
Known gap: ${node.gap}
Components: ${node.components.join(", ")}

LINKED DOCUMENTS (${linkedDocs.length}):
${docContext || "None yet linked to this node."}

Generate the ${role.label} perspective.`,
          }],
        }),
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text;
      if (!text) throw new Error("No response");
      setResponses(prev => ({ ...prev, [key]: text }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "16px", borderTop: `1px solid ${C.border}` }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: C.mono, fontSize: 9, color: C.red, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 3 }}>
            ⚡ FACETIOUS COLLABORATOR
          </div>
          <div style={{ fontSize: 11, color: C.textDimmer, lineHeight: 1.5 }}>
            The questions that don't get asked in the room.
          </div>
        </div>
        <button onClick={handleGenerate} disabled={loading} style={{
          padding: "5px 12px", borderRadius: 4, cursor: loading ? "not-allowed" : "pointer",
          background: loading ? C.surface3 : C.red + "15",
          border: `1px solid ${C.red}40`,
          color: loading ? C.textDimmer : C.red,
          fontFamily: C.mono, fontSize: 9, fontWeight: 700,
        }}>
          {loading ? "asking…" : currentResponse ? "↺ re-ask" : "◉ ask"}
        </button>
      </div>

      {/* Role tabs — scrollable row */}
      <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 8, marginBottom: 12, scrollbarWidth: "none" }}>
        {ROLES.map(r => (
          <button key={r.id} onClick={() => setActiveRole(r.id)} style={{
            padding: "5px 10px", borderRadius: 3, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
            background: activeRole === r.id ? r.color + "18" : "transparent",
            border: `1px solid ${activeRole === r.id ? r.color + "60" : C.border}`,
            color: activeRole === r.id ? r.color : C.textDim,
            fontFamily: C.mono, fontSize: 9, fontWeight: activeRole === r.id ? 700 : 400,
            transition: "all 0.1s",
          }}>
            {r.icon} {r.label}
            {responses[`${node.id}-${r.id}`] && (
              <span style={{ marginLeft: 4, color: r.color, opacity: 0.7 }}>·</span>
            )}
          </button>
        ))}
      </div>

      {/* Role voice description */}
      <div style={{ padding: "8px 10px", background: C.surface3, border: `1px solid ${C.border}`, borderRadius: 4, marginBottom: 12 }}>
        <div style={{ fontFamily: C.mono, fontSize: 9, color: role.color, fontWeight: 700, marginBottom: 4 }}>
          {role.icon} {role.label.toUpperCase()}
        </div>
        <div style={{ fontSize: 11, color: C.textDimmer, lineHeight: 1.6, fontStyle: "italic" }}>
          {role.voice}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: "8px 10px", background: C.redDim, border: `1px solid ${C.red}30`, borderRadius: 4, fontFamily: C.mono, fontSize: 10, color: C.red, marginBottom: 10 }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ fontFamily: C.mono, fontSize: 11, color: C.textDimmer, fontStyle: "italic", lineHeight: 1.7 }}>
          {role.icon} {role.label} is in the room…
        </div>
      )}

      {/* Response */}
      {!loading && currentResponse && (
        <div style={{
          fontSize: 12.5, color: C.text, lineHeight: 1.85,
          borderLeft: `2px solid ${role.color}50`, paddingLeft: 12,
          whiteSpace: "pre-wrap",
        }}>
          {currentResponse}
        </div>
      )}

      {/* Empty state */}
      {!loading && !currentResponse && !error && (
        <div style={{ fontFamily: C.mono, fontSize: 11, color: C.textDimmer, lineHeight: 1.7 }}>
          Select a role above, then hit "◉ ask" to generate the questions this stakeholder would bring to the {node.label} node — the ones that don't usually make it into the governance document.
        </div>
      )}
    </div>
  );
}

// ─── NODE DETAIL PANEL ───────────────────────────────────────────────────────
function NodeDetail({ nodeId }) {
  const node = TAXONOMY_NODES.find(n => n.id === nodeId);
  if (!node) return <div style={{ padding: 24, color: C.textDimmer, fontFamily: C.mono, fontSize: 12 }}>Select a node</div>;

  const lm = LOOP_META[node.loop];
  const linkedDocs = [
    { title: "FDA CDS Software Order", type: "regulation", source: "FDA" },
    { title: "Westgard ML Adaptation", type: "preprint", source: "arXiv" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{ padding: "18px 16px 14px", borderBottom: `1px solid ${C.border}`, background: C.surface2 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
          <span style={{ fontFamily: C.mono, fontSize: 20, color: lm.color, lineHeight: 1 }}>{node.icon}</span>
          <div>
            <div style={{ fontSize: 16, fontFamily: C.serif, fontWeight: 400, color: C.text, lineHeight: 1.2, marginBottom: 4 }}>{node.label}</div>
            <LoopPill loop={node.loop} small/>
          </div>
        </div>
        <div style={{ fontFamily: C.mono, fontSize: 11, color: C.textDim, fontStyle: "italic", lineHeight: 1.5 }}>{node.question}</div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: "auto" }}>

        {/* Components */}
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontFamily: C.mono, fontSize: 9, color: lm.color, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>COMPONENTS</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {node.components.map((c, i) => (
              <span key={i} style={{
                padding: "3px 8px", borderRadius: 3,
                background: lm.color + "10", border: `1px solid ${lm.color}25`,
                fontFamily: C.mono, fontSize: 10, color: lm.color,
              }}>{c}</span>
            ))}
          </div>
        </div>

        {/* Linked documents */}
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontFamily: C.mono, fontSize: 9, color: C.internal, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>
            LINKED DOCUMENTS <span style={{ color: C.textDimmer, fontWeight: 400 }}>({node.documents.length})</span>
          </div>
          {node.documents.map((d, i) => (
            <div key={i} style={{ padding: "5px 0", borderBottom: i < node.documents.length - 1 ? `1px solid ${C.border}` : "none", fontFamily: C.mono, fontSize: 11, color: C.textDim }}>
              ↗ {d}
            </div>
          ))}
        </div>

        {/* Matrix status + bridge */}
        <div style={{ borderBottom: `1px solid ${C.border}` }}>
          <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontFamily: C.mono, fontSize: 9, color: C.external, fontWeight: 700, letterSpacing: "0.1em" }}>
              COMMONS MATRIX
            </div>
            {node.matrixReady ? (
              <span style={{ fontFamily: C.mono, fontSize: 9, color: C.external, background: C.externalDim, border: `1px solid ${C.external}40`, borderRadius: 3, padding: "2px 7px" }}>
                ↗ promoted · row in matrix
              </span>
            ) : (
              <span style={{ fontFamily: C.mono, fontSize: 9, color: C.textDimmer, background: C.surface3, border: `1px solid ${C.border}`, borderRadius: 3, padding: "2px 7px" }}>
                taxonomy-only · not yet promoted
              </span>
            )}
          </div>
          {node.matrixReady ? (
            <>
              <div style={{ padding: "0 16px 8px", fontFamily: C.mono, fontSize: 10, color: C.textDimmer }}>
                Matrix label: <span style={{ color: C.external }}>{node.matrixLabel}</span>
              </div>
              <MatrixBridge linkedConcept={node.id}/>
            </>
          ) : (
            <div style={{ padding: "0 16px 12px", fontSize: 11, color: C.textDimmer, lineHeight: 1.6 }}>
              This node lives in the taxonomy but has not been promoted to a matrix row. To promote it: add documentation, resolve contention, then set <code style={{ background: C.surface3, padding: "1px 4px", borderRadius: 2, color: C.commons, fontFamily: C.mono, fontSize: 10 }}>matrixReady: true</code> in TAXONOMY_NODES. The matrix updates automatically.
            </div>
          )}
        </div>

        {/* AI curation */}
        <AICurationPanel node={node}/>

        {/* Facetious Collaborator */}
        <FacetiousCollaborator node={node}/>

        {/* Collab chat */}
        <CollabChat node={node}/>
      </div>
    </div>
  );
}

// ─── LAYER 4: INTAKE PANEL ───────────────────────────────────────────────────
function IntakePanel() {
  const [unlocked, setUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [mode, setMode] = useState("url");
  const [input, setInput] = useState("");
  const [fileData, setFileData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [userDocs, setUserDocs] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [sessionPassword, setSessionPassword] = useState("");

  const existingLibrarySummary = DOC_LIBRARY.map(d =>
    `[${d.id}] ${d.title} (${d.source}, ${d.year}) — ${d.abstract.slice(0, 120)}…`
  ).join("\n");

  const nodeList = TAXONOMY_NODES.map(n =>
    `${n.id}: ${n.label} (${n.loop} loop) — ${n.question}`
  ).join("\n");

  // Load persisted docs once unlocked
  const loadDocs = async (pwd) => {
    setLoadingDocs(true);
    try {
      const res = await fetch("/api/documents", {
        headers: { "x-intake-password": pwd },
      });
      if (res.status === 401) {
        setUnlocked(false);
        setPasswordError(true);
        return;
      }
      const data = await res.json();
      setUserDocs(data.documents || []);
    } catch (e) {
      // silently fail on load
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleUnlock = async () => {
    setPasswordError(false);
    const res = await fetch("/api/documents", {
      headers: { "x-intake-password": passwordInput },
    });
    if (res.status === 401) {
      setPasswordError(true);
      return;
    }
    const data = await res.json();
    setSessionPassword(passwordInput);
    setUserDocs(data.documents || []);
    setUnlocked(true);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      const mediaType = file.type || "application/pdf";
      setFileData({ base64, mediaType, name: file.name });
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (mode !== "file" && !input.trim()) return;
    if (mode === "file" && !fileData) return;
    setLoading(true);
    setResult(null);
    setError(null);

    const allDocsSummary = [
      existingLibrarySummary,
      ...userDocs.map(d => `[user:${d.title}] ${d.title} (${d.source}, ${d.year}) — ${(d.abstract||"").slice(0,120)}…`)
    ].join("\n");

    try {
      // Build message content — PDF or text
      let userContent;
      if (mode === "file" && fileData) {
        userContent = [
          {
            type: "document",
            source: { type: "base64", media_type: fileData.mediaType, data: fileData.base64 },
          },
          {
            type: "text",
            text: `EXISTING LIBRARY:\n${allDocsSummary}\n\nTAXONOMY NODES:\n${nodeList}\n\nAnalyze this document and return the JSON.`,
          },
        ];
      } else {
        userContent = `EXISTING LIBRARY:\n${allDocsSummary}\n\nTAXONOMY NODES:\n${nodeList}\n\n${mode === "url" ? "URL" : "TEXT"}:\n${input}`;
      }

      const res = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are a document intake assistant for a clinical AI governance commons. Analyze the document and respond ONLY in this exact JSON format, no other text:
{
  "title": "...",
  "source": "...",
  "year": "...",
  "type": "regulation|peer-reviewed|guideline|practitioner|report",
  "abstract": "2-3 sentence abstract in your own words",
  "overlap": {
    "exists": true/false,
    "overlappingDocs": ["doc-id or title"],
    "overlapSummary": "what is already covered",
    "whatIsNew": "what this adds that isn't already in the library"
  },
  "suggestedNodes": ["node-id-1", "node-id-2"],
  "routingRationale": "one sentence explaining why"
}`,
          messages: [{
            role: "user",
            content: userContent,
          }],
        }),
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text;
      if (!text) throw new Error("No response");
      const clean = text.replace(/```json|```/g, "").trim();
      setResult(JSON.parse(clean));
    } catch (e) {
      setError(e.message.includes("JSON") ? "Could not parse — try again" : e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-intake-password": sessionPassword,
        },
        body: JSON.stringify({ ...result, sourceInput: input }),
      });
      if (!res.ok) throw new Error("Save failed");
      await loadDocs(sessionPassword);
      setResult(null);
      setInput("");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (index) => {
    try {
      await fetch("/api/documents", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-intake-password": sessionPassword,
        },
        body: JSON.stringify({ index }),
      });
      await loadDocs(sessionPassword);
    } catch (e) {
      // silently fail
    }
  };

  const handlePromote = async (index) => {
    try {
      await fetch("/api/documents", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-intake-password": sessionPassword,
        },
        body: JSON.stringify({ index }),
      });
      await loadDocs(sessionPassword);
    } catch (e) {
      // silently fail
    }
  };

  // ── PASSWORD GATE ──
  if (!unlocked) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", padding: 40 }}>
        <div style={{ width: 340, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: 28 }}>
          <div style={{ fontFamily: C.serif, fontSize: 18, color: C.text, marginBottom: 6 }}>Private Workspace</div>
          <div style={{ fontFamily: C.mono, fontSize: 11, color: C.textDimmer, lineHeight: 1.6, marginBottom: 20 }}>
            Document intake is private. Enter your workspace password to continue.
          </div>
          <input
            type="password"
            value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleUnlock()}
            placeholder="Password"
            style={{
              width: "100%", padding: "9px 12px", borderRadius: 4, marginBottom: 10,
              background: C.surface3, border: `1px solid ${passwordError ? C.red : C.border}`,
              color: C.text, fontFamily: C.mono, fontSize: 12, outline: "none",
            }}
          />
          {passwordError && (
            <div style={{ fontFamily: C.mono, fontSize: 10, color: C.red, marginBottom: 8 }}>
              Incorrect password
            </div>
          )}
          <button onClick={handleUnlock} style={{
            width: "100%", padding: "9px", borderRadius: 4, cursor: "pointer",
            background: C.commons + "20", border: `1px solid ${C.commons}50`,
            color: C.commons, fontFamily: C.mono, fontSize: 11, fontWeight: 700,
          }}>Unlock →</button>
        </div>
      </div>
    );
  }

  // ── MAIN INTAKE UI ──
  return (
    <div style={{ padding: "24px", maxWidth: 800, margin: "0 auto" }}>
      <div style={{ marginBottom: 20, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: C.serif, fontSize: 20, color: C.text, marginBottom: 4 }}>Add Document</div>
          <div style={{ fontFamily: C.mono, fontSize: 11, color: C.textDimmer, lineHeight: 1.6 }}>
            Drop a URL or paste text. Checks overlap with existing library, suggests taxonomy routing, saves persistently.
          </div>
        </div>
        <button onClick={() => setUnlocked(false)} style={{
          padding: "4px 10px", borderRadius: 3, cursor: "pointer",
          background: "transparent", border: `1px solid ${C.border}`,
          color: C.textDimmer, fontFamily: C.mono, fontSize: 9,
        }}>lock</button>
      </div>

      {/* Mode toggle */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {[{ id: "url", label: "↗ URL" }, { id: "paste", label: "✎ Paste text" }, { id: "file", label: "📎 PDF / file" }].map(m => (
          <button key={m.id} onClick={() => { setMode(m.id); setInput(""); setFileData(null); setResult(null); }} style={{
            padding: "6px 14px", borderRadius: 4, cursor: "pointer",
            background: mode === m.id ? C.commons + "20" : "transparent",
            border: `1px solid ${mode === m.id ? C.commons + "60" : C.border}`,
            color: mode === m.id ? C.commons : C.textDim,
            fontFamily: C.mono, fontSize: 10, fontWeight: 700,
          }}>{m.label}</button>
        ))}
      </div>

      {mode === "url" && (
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="https://pubmed.ncbi.nlm.nih.gov/... or any URL"
          style={{
            width: "100%", padding: "10px 14px", borderRadius: 4,
            background: C.surface2, border: `1px solid ${C.border}`,
            color: C.text, fontFamily: C.mono, fontSize: 12, outline: "none", marginBottom: 12,
          }}
        />
      )}

      {mode === "paste" && (
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Paste abstract, notes, or any text about the document…"
          rows={8}
          style={{
            width: "100%", padding: "10px 14px", borderRadius: 4,
            background: C.surface2, border: `1px solid ${C.border}`,
            color: C.text, fontFamily: C.mono, fontSize: 12, outline: "none",
            resize: "vertical", marginBottom: 12,
          }}
        />
      )}

      {mode === "file" && (
        <div style={{
          width: "100%", padding: "20px 14px", borderRadius: 4, marginBottom: 12,
          background: C.surface2, border: `1px dashed ${fileData ? C.external : C.border}`,
          textAlign: "center", cursor: "pointer",
        }}
          onClick={() => document.getElementById("file-upload-input").click()}
        >
          <input
            id="file-upload-input"
            type="file"
            accept=".pdf,.txt,.md"
            onChange={handleFileSelect}
            style={{ display: "none" }}
          />
          {fileData ? (
            <div>
              <div style={{ fontFamily: C.mono, fontSize: 11, color: C.external, marginBottom: 4 }}>✓ {fileData.name}</div>
              <div style={{ fontFamily: C.mono, fontSize: 9, color: C.textDimmer }}>Click to replace</div>
            </div>
          ) : (
            <div>
              <div style={{ fontFamily: C.mono, fontSize: 11, color: C.textDim, marginBottom: 4 }}>Click to select a PDF or text file</div>
              <div style={{ fontFamily: C.mono, fontSize: 9, color: C.textDimmer }}>Supports PDF, .txt, .md</div>
            </div>
          )}
        </div>
      )}

      <button onClick={handleAnalyze} disabled={loading || (mode === "file" ? !fileData : !input.trim())} style={{
        padding: "8px 20px", borderRadius: 4, cursor: loading ? "not-allowed" : "pointer",
        background: C.commons + "20", border: `1px solid ${C.commons}60`,
        color: C.commons, fontFamily: C.mono, fontSize: 11, fontWeight: 700, marginBottom: 24,
      }}>
        {loading ? "Analyzing…" : "◉ Analyze"}
      </button>

      {error && (
        <div style={{ padding: "10px 14px", background: C.redDim, border: `1px solid ${C.red}30`, borderRadius: 4, fontFamily: C.mono, fontSize: 11, color: C.red, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Analysis result */}
      {result && (
        <div style={{ background: C.surface2, border: `1px solid ${C.borderBright}`, borderRadius: 6, overflow: "hidden", marginBottom: 24 }}>
          <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontFamily: C.mono, fontSize: 9, color: C.handoff, background: C.handoffDim, border: `1px solid ${C.handoff}30`, borderRadius: 2, padding: "2px 6px", fontWeight: 700 }}>
                {result.type?.toUpperCase()}
              </span>
              <span style={{ fontFamily: C.mono, fontSize: 10, color: C.textDim }}>{result.source} · {result.year}</span>
            </div>
            <div style={{ fontSize: 14, color: C.text, fontWeight: 500, lineHeight: 1.4 }}>{result.title}</div>
          </div>

          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontFamily: C.mono, fontSize: 9, color: C.internal, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 6 }}>ABSTRACT</div>
            <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.7 }}>{result.abstract}</div>
          </div>

          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, background: result.overlap?.exists ? C.handoffDim : C.externalDim }}>
            <div style={{ fontFamily: C.mono, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 6, color: result.overlap?.exists ? C.handoff : C.external }}>
              {result.overlap?.exists ? "⚡ OVERLAP DETECTED" : "✓ NO SIGNIFICANT OVERLAP"}
            </div>
            {result.overlap?.exists ? (
              <>
                <div style={{ fontSize: 11.5, color: C.textDim, lineHeight: 1.6, marginBottom: 4 }}>
                  <strong style={{ color: C.text }}>Already covered by:</strong> {result.overlap.overlappingDocs?.join(", ")}
                </div>
                <div style={{ fontSize: 11.5, color: C.textDim, lineHeight: 1.6, marginBottom: 4 }}>
                  <strong style={{ color: C.text }}>Overlap:</strong> {result.overlap.overlapSummary}
                </div>
                <div style={{ fontSize: 11.5, color: C.textDim, lineHeight: 1.6 }}>
                  <strong style={{ color: C.external }}>What's new:</strong> {result.overlap.whatIsNew}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 11.5, color: C.textDim, lineHeight: 1.6 }}>
                This document covers ground not yet in the library. Worth adding.
              </div>
            )}
          </div>

          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontFamily: C.mono, fontSize: 9, color: C.external, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>ROUTES TO</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {result.suggestedNodes?.map(nid => {
                const node = TAXONOMY_NODES.find(n => n.id === nid);
                if (!node) return null;
                const lm = LOOP_META[node.loop];
                return (
                  <span key={nid} style={{
                    padding: "3px 9px", borderRadius: 3,
                    background: lm.color + "15", border: `1px solid ${lm.color}35`,
                    color: lm.color, fontFamily: C.mono, fontSize: 10,
                  }}>{node.icon} {node.label}</span>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: C.textDimmer, fontStyle: "italic" }}>{result.routingRationale}</div>
          </div>

          <div style={{ padding: "12px 16px", display: "flex", gap: 8 }}>
            <button onClick={handleSave} disabled={saving} style={{
              padding: "7px 16px", borderRadius: 4, cursor: saving ? "not-allowed" : "pointer",
              background: C.external + "20", border: `1px solid ${C.external}50`,
              color: C.external, fontFamily: C.mono, fontSize: 10, fontWeight: 700,
            }}>{saving ? "Saving…" : "+ Save to library"}</button>
            <button onClick={() => setResult(null)} style={{
              padding: "7px 16px", borderRadius: 4, cursor: "pointer",
              background: "transparent", border: `1px solid ${C.border}`,
              color: C.textDim, fontFamily: C.mono, fontSize: 10,
            }}>Discard</button>
          </div>
        </div>
      )}

      {/* Persisted user library */}
      {loadingDocs ? (
        <div style={{ fontFamily: C.mono, fontSize: 11, color: C.textDimmer }}>Loading your library…</div>
      ) : userDocs.length > 0 && (
        <div>
          <div style={{ fontFamily: C.mono, fontSize: 9, color: C.textDimmer, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 10 }}>
            YOUR LIBRARY ({userDocs.length} documents)
          </div>
          {userDocs.map((d, i) => (
            <div key={i} style={{
              padding: "10px 14px", background: C.surface2, border: `1px solid ${C.border}`,
              borderRadius: 4, marginBottom: 6, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: C.mono, fontSize: 9, color: C.handoff, background: C.handoffDim, border: `1px solid ${C.handoff}30`, borderRadius: 2, padding: "1px 5px", fontWeight: 700 }}>
                    {d.type?.toUpperCase()}
                  </span>
                  <span style={{ fontFamily: C.mono, fontSize: 10, color: C.textDim }}>{d.source} · {d.year}</span>
                  <span style={{ fontFamily: C.mono, fontSize: 9, color: C.textDimmer }}>{new Date(d.addedAt).toLocaleDateString()}</span>
                </div>
                <div style={{ fontSize: 12.5, color: C.text, marginBottom: 4 }}>{d.title}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {d.suggestedNodes?.map(nid => {
                    const node = TAXONOMY_NODES.find(n => n.id === nid);
                    if (!node) return null;
                    return (
                      <span key={nid} style={{
                        fontFamily: C.mono, fontSize: 9, color: LOOP_META[node.loop].color,
                        background: LOOP_META[node.loop].color + "10",
                        border: `1px solid ${LOOP_META[node.loop].color}25`,
                        borderRadius: 2, padding: "1px 5px",
                      }}>{node.icon} {node.label}</span>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                <button onClick={() => handlePromote(i)} style={{
                  padding: "3px 8px", borderRadius: 3, cursor: "pointer",
                  background: d.promoted ? C.external + "20" : "transparent",
                  border: `1px solid ${d.promoted ? C.external + "60" : C.border}`,
                  color: d.promoted ? C.external : C.textDim,
                  fontFamily: C.mono, fontSize: 9, whiteSpace: "nowrap",
                }}>{d.promoted ? "✓ public" : "↑ promote"}</button>
                <button onClick={() => handleDelete(i)} style={{
                  padding: "3px 8px", borderRadius: 3, cursor: "pointer",
                  background: "transparent", border: `1px solid ${C.border}`,
                  color: C.textDimmer, fontFamily: C.mono, fontSize: 9,
                }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {userDocs.length === 0 && !loadingDocs && (
        <div style={{ fontFamily: C.mono, fontSize: 11, color: C.textDimmer, lineHeight: 1.7 }}>
          Your personal library is empty. Add your first document above — it will persist across sessions.
        </div>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function GovernanceCommons() {
  const [activeLayer, setActiveLayer] = useState("taxonomy"); // docs | taxonomy | matrix
  const [activeNodeId, setActiveNodeId] = useState("stop");
  const [loopFilter, setLoopFilter] = useState("all");

  const handleNavigate = (layer, nodeId) => {
    setActiveLayer(layer);
    if (nodeId) setActiveNodeId(nodeId);
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, display: "flex", flexDirection: "column" }}>

      {/* Top bar */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "16px 24px", display: "flex", alignItems: "center", gap: 20, background: C.surface, flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: C.serif, fontSize: 18, fontWeight: 400, color: C.text, letterSpacing: "0.01em" }}>Governance Commons</div>
          <div style={{ fontFamily: C.mono, fontSize: 10, color: C.textDimmer, letterSpacing: "0.08em", marginTop: 2 }}>CLINICAL AI GOVERNANCE INFRASTRUCTURE · LIVING MAP</div>
        </div>

        <div style={{ display: "flex", gap: 2, marginLeft: "auto" }}>
          {[
            { id: "docs",     label: "① Doc Repository" },
            { id: "taxonomy", label: "② Taxonomy Navigator" },
            { id: "matrix",   label: "③ Commons Matrix" },
            { id: "intake",   label: "④ Add Document" },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveLayer(tab.id)} style={{
              padding: "7px 14px", borderRadius: 4, cursor: "pointer",
              background: activeLayer === tab.id ? C.commons + "20" : "transparent",
              border: `1px solid ${activeLayer === tab.id ? C.commons + "60" : C.border}`,
              color: activeLayer === tab.id ? C.commons : C.textDim,
              fontFamily: C.mono, fontSize: 10, fontWeight: activeLayer === tab.id ? 700 : 400,
              letterSpacing: "0.05em",
            }}>{tab.label}</button>
          ))}
        </div>

        {/* Loop filter pills */}
        {activeLayer === "taxonomy" && (
          <div style={{ display: "flex", gap: 4 }}>
            {["all", "internal", "handoff", "external", "commons"].map(f => {
              const color = f === "all" ? C.textDim : LOOP_META[f]?.color;
              return (
                <button key={f} onClick={() => setLoopFilter(f)} style={{
                  padding: "4px 8px", borderRadius: 3, cursor: "pointer",
                  background: loopFilter === f ? color + "20" : "transparent",
                  border: `1px solid ${loopFilter === f ? color + "50" : C.border}`,
                  color: loopFilter === f ? color : C.textDimmer,
                  fontFamily: C.mono, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
                }}>{f}</button>
              );
            })}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* ── LAYER: DOC REPO ── */}
        {activeLayer === "docs" && (
          <div style={{ flex: 1, overflowY: "auto" }}>
            <DocRepository onNavigate={handleNavigate}/>
          </div>
        )}

        {/* ── LAYER: TAXONOMY ── */}
        {activeLayer === "taxonomy" && (
          <>
            {/* Left: taxonomy nav */}
            <div style={{ width: 280, flexShrink: 0, borderRight: `1px solid ${C.border}`, overflowY: "auto", background: C.surface }}>
              <TaxonomyNavigator
                activeNodeId={activeNodeId}
                onSelectNode={id => setActiveNodeId(id)}
                loopFilter={loopFilter}
              />
            </div>
            {/* Right: node detail */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              <NodeDetail nodeId={activeNodeId}/>
            </div>
          </>
        )}

        {/* ── LAYER: MATRIX ── */}
        {activeLayer === "matrix" && (
          <div style={{ flex: 1, overflowY: "auto" }}>
            <MatrixBridge linkedConcept="stop"/>
          </div>
        )}

        {/* ── LAYER: INTAKE ── */}
        {activeLayer === "intake" && (
          <div style={{ flex: 1, overflowY: "auto" }}>
            <IntakePanel/>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div style={{ borderTop: `1px solid ${C.border}`, padding: "6px 24px", background: C.surface, display: "flex", gap: 20, alignItems: "center", flexShrink: 0 }}>
        {Object.entries(LOOP_META).map(([key, m]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: 1, background: m.color }}/>
            <span style={{ fontFamily: C.mono, fontSize: 9, color: C.textDimmer }}>{m.label}</span>
          </div>
        ))}
        <div style={{ marginLeft: "auto", fontFamily: C.mono, fontSize: 9, color: C.textDimmer }}>
          {TAXONOMY_NODES.length} nodes · {MATRIX_CONCEPTS.length} promoted to matrix · {Object.keys(MATRIX_CELLS).length} intersections · taxonomy-driven
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1c2a3a; border-radius: 2px; }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
      `}</style>
    </div>
  );
}
