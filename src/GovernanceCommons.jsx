import { useState, useEffect } from "react";
import ConstellationMap from "./ConstellationMap";
import NODES from "./data/nodes.json";
import NodeBody from "./NodePage";

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
  forming:      "#94a3b8",
  formingDim:   "rgba(148,163,184,0.08)",
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
  forming:  { label: "Forming Territory", color: C.forming, question: "What governance concepts belong here but don't yet have a settled node shape?" },
};

const ALL_USE_CASES = [
  { id: "diagnostic", label: "Diagnostic Aid"  },
  { id: "screening",  label: "Screening Tool"  },
  { id: "monitoring", label: "Monitoring Tool" },
  { id: "triage",     label: "Triage Tool"     },
  { id: "treatment",  label: "Treatment Rec."  },
  { id: "admin",      label: "Admin / Ops AI"  },
];

// Node content lives in src/data/nodes.json, the single source of truth for
// the taxonomy, the node pages, and the AI prompts.
const TAXONOMY_NODES = NODES.map(n => ({ ...n, documents: n.artifacts }));

const MATRIX_CONCEPTS = TAXONOMY_NODES
  .filter(n => n.matrixReady && n.matrixLabel)
  .map(n => ({ id: n.id, label: n.matrixLabel, icon: n.icon, loop: n.loop }));

const MATRIX_USECASES = ALL_USE_CASES;

const MATRIX_CELLS = {
  "h2-diagnostic":          { d:4,c:2,x:2,v:3, status:"live",   summary:"Who decides routing threshold? FDA 510(k) predicate logic applies." },
  "h2-screening":           { d:3,c:1,x:1,v:2, status:"live",   summary:"Population-level screening authority differs from individual clinical decisions." },
  "h2-monitoring":          { d:2,c:1,x:0,v:1, status:"sparse", summary:"Ongoing authority for model drift is often unclear post-deployment." },
  "h2-triage":              { d:3,c:2,x:2,v:2, status:"live",   summary:"Time-critical decisions require pre-defined authority chains." },
  "h2-treatment":           { d:2,c:0,x:3,v:1, status:"sparse", summary:"Prescribing authority cannot be delegated to algorithm." },
  "h2-admin":               { d:1,c:1,x:0,v:1, status:"sparse", summary:"Workflow AI authority is lower stakes but underdocumented." },
  "h1-diagnostic":          { d:3,c:2,x:1,v:3, status:"live",   summary:"Confidence score → routing tier mapping. When does low-confidence flag human?" },
  "h1-screening":           { d:2,c:1,x:1,v:1, status:"sparse", summary:"FP/FN asymmetry drives routing logic." },
  "h1-monitoring":          { d:2,c:2,x:2,v:2, status:"live",   summary:"Statistical control limits as escalation triggers. Westgard adapted to ML." },
  "h1-triage":              { d:4,c:3,x:2,v:3, status:"live",   summary:"Time-critical escalation with defined information package." },
  "h1-treatment":           { d:1,c:0,x:2,v:0, status:"gap",    summary:"No clear examples of treatment escalation protocols in deployed systems." },
  "h1-admin":               { d:1,c:1,x:0,v:1, status:"sparse", summary:"Workflow disruption escalation less studied." },
  "stop-diagnostic":        { d:5,c:3,x:3,v:4, status:"live",   summary:"Hard stop conditions: data quality failure, confidence below threshold, EHR mismatch." },
  "stop-screening":         { d:3,c:2,x:2,v:2, status:"live",   summary:"Population-level stops vs. individual result suppression." },
  "stop-monitoring":        { d:3,c:1,x:1,v:2, status:"live",   summary:"Automated drift detection triggers." },
  "stop-triage":            { d:2,c:1,x:2,v:1, status:"sparse", summary:"Stop in time-critical context is itself a patient safety event." },
  "stop-treatment":         { d:1,c:0,x:3,v:0, status:"gap",    summary:"Critical gap. No agreed framework for treatment recommendation stops." },
  "stop-admin":             { d:1,c:1,x:0,v:1, status:"sparse", summary:"Ops AI stops create workflow disruption." },
  "watcher-diagnostic":     { d:4,c:2,x:1,v:2, status:"live",   summary:"Post-deployment performance tracking. Retrospective accuracy vs. real-time drift." },
  "watcher-screening":      { d:3,c:2,x:1,v:2, status:"live",   summary:"Population shift detection. Subgroup drift." },
  "watcher-monitoring":     { d:2,c:0,x:0,v:1, status:"sparse", summary:"Monitoring of monitoring tools — mostly conceptual." },
  "watcher-triage":         { d:2,c:1,x:1,v:1, status:"sparse", summary:"Triage accuracy monitoring complicated by outcome attribution." },
  "watcher-treatment":      { d:2,c:1,x:2,v:1, status:"sparse", summary:"Clinical outcome tracking. Long attribution chains." },
  "watcher-admin":          { d:1,c:1,x:0,v:0, status:"gap",    summary:"Admin AI monitoring almost undocumented." },
  "h4-diagnostic":          { d:3,c:2,x:0,v:2, status:"live",   summary:"FDA expects documentation of training data lineage." },
  "h4-screening":           { d:2,c:1,x:0,v:1, status:"sparse", summary:"Screening audit aligns mostly with standard EHR documentation." },
  "h4-monitoring":          { d:2,c:0,x:0,v:1, status:"sparse", summary:"Monitoring data as audit artifact." },
  "h4-triage":              { d:2,c:1,x:0,v:1, status:"sparse", summary:"ED triage audit complexity — multiple AI touchpoints." },
  "h4-treatment":           { d:1,c:0,x:1,v:0, status:"gap",    summary:"Treatment recommendation audit: underdeveloped." },
  "h4-admin":               { d:1,c:0,x:0,v:0, status:"gap",    summary:"No standard." },
  "override-diagnostic":    { d:4,c:3,x:3,v:4, status:"live",   summary:"Clinician override of algorithmic recommendation. Logged? Reviewed? Fed back?" },
  "override-screening":     { d:2,c:1,x:1,v:2, status:"sparse", summary:"Override logic differs when screening is async vs. real-time." },
  "override-monitoring":    { d:2,c:1,x:1,v:1, status:"sparse", summary:"Override of automated monitoring alerts." },
  "override-triage":        { d:3,c:2,x:2,v:3, status:"live",   summary:"Override in time-critical context. Documentation burden vs. speed of care." },
  "override-treatment":     { d:2,c:1,x:3,v:2, status:"sparse", summary:"Highly contested. Most active area of governance debate." },
  "override-admin":         { d:1,c:0,x:0,v:0, status:"gap",    summary:"Admin override tracking largely absent." },
  "validation-diagnostic":  { d:5,c:3,x:2,v:3, status:"live",   summary:"Clinical + analytical validation, EHR integration testing, FDA clearance." },
  "validation-screening":   { d:4,c:2,x:1,v:2, status:"live",   summary:"Population representativeness. Training-serving skew." },
  "validation-monitoring":  { d:2,c:1,x:0,v:1, status:"sparse", summary:"Validation of monitoring infrastructure itself." },
  "validation-triage":      { d:3,c:2,x:1,v:2, status:"live",   summary:"Prospective vs. retrospective validation for triage tools." },
  "validation-treatment":   { d:2,c:1,x:2,v:1, status:"sparse", summary:"RCT vs. real-world evidence debate." },
  "validation-admin":       { d:1,c:1,x:0,v:1, status:"sparse", summary:"Admin AI validation: no standard framework." },
};

const DOC_LIBRARY = [
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
  {
    id: "guvenc-ecg-2025",
    title: "ECG Arrhythmia Detection Governance Demo: Stop Mechanism Implementation with MIMIC-IV",
    type: "practitioner", source: "Lindsay LaMere / GitHub", year: "2025",
    url: "https://github.com/lindsayguvenc-coder/ecg-governance-demo",
    nodes: ["stop","validation","watcher"],
    abstract: "Concrete implementation of a governance framework for ECG arrhythmia detection AI using MIMIC-IV data. Demonstrates Westgard-adapted stop thresholds, authority matrix for hard stop activation, and escalation protocol design. The only publicly available example of CLIA QC principles applied to AI inference monitoring in a clinical diagnostic aid context.",
  },
  {
    id: "westgard-ml-adaptation",
    title: "Westgard Multi-Rule Framework Adapted for ML Inference Monitoring: QC Principles for Clinical AI",
    type: "practitioner", source: "Lindsay LaMere / Governance Commons", year: "2025",
    url: null,
    nodes: ["stop","watcher","h1"],
    abstract: "Translation of Westgard 2-of-3s, 4-1s, and 10-x rules from laboratory QC into ML inference monitoring context. Core argument: whoever signs the corrective action owns the governance decision — authority follows existing accountability structures rather than creating new ones. Addresses the fixed vs. adaptive threshold debate by proposing population-stratified control limits as a bridge position.",
  },
  {
    id: "ihi-leape-2024",
    title: "Bringing Safety to AI: Adapting Patient Safety Principles to Artificial Intelligence in Health Care",
    type: "guideline", source: "IHI / Lucian Leape Institute", year: "2024",
    url: "https://www.ihi.org/resources/white-papers/bringing-safety-ai-adapting-patient-safety-principles-artificial-intelligence-health-care",
    nodes: ["stop","authority","escalation","h1"],
    abstract: "IHI framework applying established patient safety principles (Just Culture, high reliability, safety I/II) to clinical AI deployment. Argues that AI governance requires the same structural elements as patient safety programs: clear authority, non-punitive error reporting, stop mechanisms, and prospective hazard analysis. Most directly applicable to stop mechanism and authority tier design.",
  },
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
  // ── COMMUNITY WEAVING SERIES ──────────────────────────────────────────────
// Add these entries to DOC_LIBRARY in GovernanceCommons.jsx
// Paste after the last existing entry (apollo-2024)

  {
    id: "cw-ep01",
    title: "Community Weaving Episode 01: The Loom is Missing",
    type: "practitioner", source: "Lindsay LaMere / Healthcare Governance Commons", year: "2025",
    url: "/community_weaving_ep01.pdf",
    nodes: ["commons"],
    abstract: "Opening episode of the Community Weaving series. Identifies five domains where knowledge outpaces coordination — clinical AI, pandemic preparedness, climate adaptation, democratic renewal, and economic transition. Names the structural gap underneath all of them: the missing container for collaborative governance work. Establishes the loom metaphor that anchors the series.",
  },
  {
    id: "cw-ep02",
    title: "Community Weaving Episode 02: Why the Tools We Have Fail",
    type: "practitioner", source: "Lindsay LaMere / Healthcare Governance Commons", year: "2025",
    url: "/community_weaving_ep02.pdf",
    nodes: ["commons", "h2"],
    abstract: "Diagnoses why linear tools — checklists, frameworks, maturity models — break down in high-stakes, multi-dimensional domains. Argues that the failure is structural, not implementational: these tools were designed for stable, well-mapped problems and cannot hold the complexity of domains where the map doesn't exist yet. Directly relevant to authority matrix design and threshold authority.",
  },
  {
    id: "cw-ep03",
    title: "Community Weaving Episode 03: The Loom",
    type: "practitioner", source: "Lindsay LaMere / Healthcare Governance Commons", year: "2025",
    url: "/community_weaving_ep03.pdf",
    nodes: ["commons"],
    abstract: "Defines Community Weaving as a methodology and traces its historical instances across domains and centuries. Argues that the loom — the container for collaborative, friction-positive knowledge-building — keeps getting built independently by people who never knew each other's work, because the need is structural. Foundational document for the Commons architecture.",
  },
  {
    id: "cw-ep04",
    title: "Community Weaving Episode 04: The Commons as Proof of Concept",
    type: "practitioner", source: "Lindsay LaMere / Healthcare Governance Commons", year: "2025",
    url: "/community_weaving_ep04.pdf",
    nodes: ["commons", "watcher"],
    abstract: "Documents what building the Healthcare Governance Commons actually revealed — about clinical AI governance gaps, about the infrastructure problem, and about the method itself. The Commons is simultaneously the subject of the series and an instance of the methodology it describes. Key for understanding the dual-loop architecture as a lived design decision rather than a theoretical framework.",
  },
  {
    id: "cw-ep05",
    title: "Community Weaving Episode 05: The Shared Mental Model Problem",
    type: "practitioner", source: "Lindsay LaMere / Healthcare Governance Commons", year: "2025",
    url: "/community_weaving_ep05.pdf",
    nodes: ["norm", "h2"],
    abstract: "Argues that lexicon is coordination infrastructure — that a shared definition is not the same as a shared mental model, and that the gap between them is where most governance breakdowns actually occur. Directly relevant to the normalization layer and threshold authority nodes. The taxonomy/lexicon component of the internal technical loop is the structural answer to the problem this episode names.",
  },
  {
    id: "cw-ep06",
    title: "Community Weaving Episode 06: Disagreement as Data",
    type: "practitioner", source: "Lindsay LaMere / Healthcare Governance Commons", year: "2025",
    url: "/community_weaving_ep06.pdf",
    nodes: ["h2", "adjudicate"],
    abstract: "Reframes disagreement as the most important signal a governance system produces — not a problem to resolve but information about the system. Introduces the five unpacking lenses: hidden assumptions, values in tension, lived experience, risk models, and time horizons. Foundational document for the dissent layer and dispute adjudication nodes. Companion to the Disagreement Unpacker tool.",
  },
  {
    id: "cw-ep07",
    title: "Community Weaving Episode 07: What it Actually Looks Like",
    type: "practitioner", source: "Lindsay LaMere / Healthcare Governance Commons", year: "2025",
    url: "/community_weaving_ep07.pdf",
    nodes: ["watcher", "h1", "h2", "h3", "h4", "stop", "authority", "commons"],
    abstract: "The architecture episode. Describes the full dual-loop governance framework — internal technical loop (AI model, performance monitor, taxonomy, institutional memory) and external human governance loop (clinical judgment, authority matrix, dissent layer, decision trigger layer) — with all four handoff nodes and the stop mechanism. The most directly applicable episode for practitioners building governance infrastructure. Interactive version available at /architecture.",
  },
  {
    id: "cw-ep08",
    title: "Community Weaving Episode 08: The Recursive Close",
    type: "practitioner", source: "Lindsay LaMere / Healthcare Governance Commons", year: "2025",
    url: "/community_weaving_ep08.pdf",
    nodes: ["commons"],
    abstract: "Closing episode of the series. Argues that the series itself is the method — built in public, iteratively, with friction visible. The Commons is the thing it describes: the dual-loop architecture it documents is the architecture it runs on. Frames clinical AI governance as a container problem, not a technology problem, and positions the Commons as a translation layer making existing safety science accessible to practitioners who need it now.",
  },

// ── GOVERNANCE COMMONS TOOLS ──────────────────────────────────────────────
// The tools themselves as practitioner documents

  {
    id: "tool-disagreement-unpacker",
    title: "The Disagreement Unpacker: AI-Powered Conflict Analysis Tool",
    type: "practitioner", source: "Lindsay LaMere / Healthcare Governance Commons", year: "2025",
    url: "/transition#disagreement-unpacker",
    nodes: ["h2", "adjudicate"],
    abstract: "Interactive AI-powered tool implementing the Disagreement as Data methodology from Community Weaving Episode 06. Takes a described disagreement and returns a structured map across five lenses: hidden assumptions, values in tension, lived experience, risk models, and time horizons. Includes synthesis and facilitator move. Directly applicable to threshold authority disputes and dispute adjudication processes. Available at /transition.",
  },
  {
    id: "tool-container-health-check",
    title: "Container Health Check: AI-Powered Governance Container Assessment",
    type: "practitioner", source: "Lindsay LaMere / Healthcare Governance Commons", year: "2025",
    url: "/transition#container-health-check",
    nodes: ["commons", "authority"],
    abstract: "Interactive AI-powered tool that assesses a governance container against five Good Container properties — legitimacy without capture, psychological safety for radical honesty, time insulated from urgency, cross-domain intimacy, and narrative incubation — and flags which of five failure modes are active or at risk. Returns health scores per property with concrete recommendations. Available at /transition.",
  },
  {
    id: "tool-charter-builder",
    title: "The Charter Builder: AI-Powered Governance Charter Generator",
    type: "practitioner", source: "Lindsay LaMere / Healthcare Governance Commons", year: "2025",
    url: "/transition#charter-builder",
    nodes: ["commons", "authority", "h2"],
    abstract: "Interactive AI-powered tool that generates a draft governance charter by translating six core principles — dignity before efficiency, psychological safety, disagreement as data, radical honesty, equity and representation, and dual-horizon discipline — into specific rules, metrics, and failsafes for the user's exact context. Takes five inputs about context, domain, stakes, failure mode concerns, and required stakeholders. Output is copyable. Available at /transition.",
  },
  {
    id: "tool-architecture-explorer",
    title: "The Governance Architecture: Interactive Dual-Loop Explorer",
    type: "practitioner", source: "Lindsay LaMere / Healthcare Governance Commons", year: "2025",
    url: "/architecture",
    nodes: ["watcher", "h1", "h2", "h3", "h4", "stop", "authority", "commons"],
    abstract: "Interactive visualization of the full dual-loop clinical AI governance architecture. Every component — eight loop nodes, four handoff nodes, stop mechanism, and failover protocol — is clickable with a detail panel showing what it does and why it exists. Companion to Community Weaving Episode 07. Designed as a reference tool for practitioners building or evaluating governance infrastructure. Available at /architecture.",
  },

// ── GOVERNANCE MECHANISMS INDEX ──────────────────────────────────────────

  {
    id: "governance-mechanisms-index",
    title: "Governance Mechanisms Index: Cross-Domain Reference — What Held, What Failed, Where",
    type: "practitioner", source: "Lindsay LaMere / Healthcare Governance Commons", year: "2025",
    url: "/governance_mechanisms_index.pdf",
    nodes: ["stop", "watcher", "h1", "adjudicate", "authority", "commons"],
    abstract: "Cross-domain reference index of governance mechanisms across aviation, nuclear, laboratory medicine, financial services, pharmaceutical, and software engineering — indexed by mechanism type, loop location, and observed outcome. Each entry documents where the mechanism held, where it failed, and the honest complexity. Identifies five cross-domain structural patterns: separation from enforcement, distributed liability, explicit stop conditions, loop-level specificity, and transparency gaps. The most directly applicable cross-domain reference in the Commons library for practitioners designing clinical AI governance infrastructure.",
  },

// ── HEALTHCARE DATA CHECKLIST ─────────────────────────────────────────────
// Already in commons as a file — registering here for Doc Repository visibility

  {
    id: "hc-data-checklist",
    title: "Healthcare AI Governance Checklist: Deployment Readiness",
    type: "practitioner", source: "Lindsay LaMere / Healthcare Governance Commons", year: "2025",
    url: "/checklist.html",
    nodes: ["validation", "stop", "h2", "authority"],
    abstract: "Structured deployment readiness checklist for clinical AI tools. Covers validation requirements, authority assignment, stop mechanism definition, monitoring infrastructure, and escalation pathway design. Adapted from CLIA/CAP quality control frameworks and high-reliability organization principles. Designed for use at H1 Deploy handoff — the governance contract activation point.",
  },
];

// Practitioner notes and key insights come from the same data file.
const CHAT_THREADS = Object.fromEntries(NODES.map(n => [n.id, n.notes]));
const NODE_CONTEXT = Object.fromEntries(
  NODES.filter(n => n.keyDocs.length || n.insight).map(n => [n.id, { keyDocs: n.keyDocs, keyInsight: n.insight }])
);

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

function TaxonomyNavigator({ activeNodeId, onSelectNode, loopFilter }) {
  const grouped = ["internal","handoff","external","forming","commons"].map(loop => ({
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

// Minimal rendering for AI answers: **bold** and "# " headings; no HTML injection.
function AIText({ text }) {
  return text.split("\n").map((line, i) => {
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    const content = heading ? heading[1] : line;
    const parts = content.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
      /^\*\*[^*]+\*\*$/.test(part)
        ? <strong key={j} style={{ color: C.text, fontWeight: 600 }}>{part.slice(2, -2)}</strong>
        : part
    );
    return (
      <span key={i} style={heading ? { display: "block", color: C.text, fontWeight: 600, marginTop: i ? 6 : 0 } : undefined}>
        {parts}{heading ? null : "\n"}
      </span>
    );
  });
}

function AICurationPanel({ node }) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [lastGenerated, setLastGenerated] = useState(null);

  const lm = LOOP_META[node.loop];
  const ctx = NODE_CONTEXT[node.id];

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
          max_tokens: 2500,
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
        <div>
        <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.75, borderLeft: `2px solid ${C.commons}40`, paddingLeft: 10, whiteSpace: "pre-wrap" }}>
          <AIText text={summary}/>
        </div>
        <div style={{ fontFamily: C.mono, fontSize: 9, color: C.textDimmer, marginTop: 8, letterSpacing: "0.04em" }}>
          AI-generated · not reviewed by a person
        </div>
        </div>
      )}

      {!loading && !summary && !error && (
        <div style={{ fontFamily: C.mono, fontSize: 11, color: C.textDimmer, lineHeight: 1.6 }}>
          Click "◉ synthesize" to generate a real-time AI synthesis of the {DOC_LIBRARY.filter(d => d.nodes.includes(node.id)).length} documents linked to this node.
        </div>
      )}

    </div>
  );
}


function MatrixBridge({ linkedConcept }) {
  const [activeConcept, setActiveConcept] = useState(linkedConcept || MATRIX_CONCEPTS[2].id);
  const [activeUseCase, setActiveUseCase] = useState("diagnostic");

  return (
    <div style={{ padding: "16px 20px" }}>
      <div style={{ fontFamily: C.mono, fontSize: 10, color: C.textDimmer, letterSpacing: "0.08em", marginBottom: 10 }}>
        GOVERNANCE COMMONS MATRIX — use case × concept
      </div>

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

const ROLES = [
  { id: "clin-ops", label: "Clinical Ops", icon: "🏥", voice: "Operational realist. Has been handed frameworks that looked great on paper and failed on the floor. Asks about coverage, workflows, and what happens at 2am.", color: "#38bdf8" },
  { id: "clinician", label: "Clinician", icon: "🩺", voice: "Point-of-care practitioner. Skeptical of anything that adds cognitive load during high-acuity moments. Asks whether the AI output is actually usable in context and who's responsible when they disagree with it.", color: "#10b981" },
  { id: "patient", label: "Patient", icon: "🧑", voice: "The person the system is ostensibly for. Asks whether they were consulted, whether they can opt out, what happens if the algorithm is wrong about them, and who they talk to.", color: "#c084fc" },
  { id: "compliance", label: "Compliance / Legal", icon: "⚖️", voice: "Liability-focused. Asks about documentation trails, regulatory exposure, what happens when a decision is challenged post-incident, and whether any of this has been through legal review.", color: "#f59e0b" },
  { id: "risk", label: "Risk", icon: "🛡️", voice: "Enterprise risk manager. Asks about failure modes, insurance implications, what the institution's exposure is if this goes wrong, and whether risk has formally signed off.", color: "#f43f5e" },
  { id: "patient-safety", label: "Patient Safety", icon: "🔒", voice: "Quality and safety officer. Asks what the harm profile looks like, whether near-misses will be captured, and whether there's a reporting pathway when the AI contributes to an adverse event.", color: "#fb923c" },
  { id: "exec", label: "Executive Leadership", icon: "📊", voice: "C-suite or VP level. Asks about strategic rationale, resource requirements, who owns this long-term, and what the institution is committing to when it deploys this.", color: "#e879f9" },
  { id: "vendor", label: "Vendor", icon: "🏢", voice: "The AI system's vendor. Asks what the institution is actually responsible for versus what they cover, what contract terms govern governance obligations, and whether the institution's requirements are technically feasible.", color: "#94a3b8" },
  { id: "ai-eng", label: "AI Engineering", icon: "🧠", voice: "ML engineer or data scientist. Asks whether the model was validated on this population, whether the confidence scores are calibrated, what distribution shift looks like, and who owns retraining.", color: "#67e8f9" },
  { id: "enterprise-it", label: "Enterprise IT", icon: "🖧", voice: "Infrastructure and integration owner. Asks how this connects to the EHR, who owns the integration when it breaks, whether this is on the approved vendor list, and what the downtime protocol is.", color: "#86efac" },
  { id: "ethics", label: "Ethics", icon: "◎", voice: "Clinical or organizational ethicist. Asks who benefits from this deployment, who bears the cost if it's wrong, whether equity implications have been assessed, and under what conditions the institution should stop even if performance metrics look fine.", color: "#fde68a" },
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
          max_tokens: 2500,
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: C.mono, fontSize: 9, color: C.red, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 3 }}>⚡ FACETIOUS COLLABORATOR</div>
          <div style={{ fontSize: 11, color: C.textDimmer, lineHeight: 1.5 }}>The questions that don't get asked in the room.</div>
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
            {responses[`${node.id}-${r.id}`] && <span style={{ marginLeft: 4, color: r.color, opacity: 0.7 }}>·</span>}
          </button>
        ))}
      </div>

      <div style={{ padding: "8px 10px", background: C.surface3, border: `1px solid ${C.border}`, borderRadius: 4, marginBottom: 12 }}>
        <div style={{ fontFamily: C.mono, fontSize: 9, color: role.color, fontWeight: 700, marginBottom: 4 }}>{role.icon} {role.label.toUpperCase()}</div>
        <div style={{ fontSize: 11, color: C.textDimmer, lineHeight: 1.6, fontStyle: "italic" }}>{role.voice}</div>
      </div>

      {error && (
        <div style={{ padding: "8px 10px", background: C.redDim, border: `1px solid ${C.red}30`, borderRadius: 4, fontFamily: C.mono, fontSize: 10, color: C.red, marginBottom: 10 }}>{error}</div>
      )}

      {loading && (
        <div style={{ fontFamily: C.mono, fontSize: 11, color: C.textDimmer, fontStyle: "italic", lineHeight: 1.7 }}>
          {role.icon} {role.label} is in the room…
        </div>
      )}

      {!loading && currentResponse && (
        <div>
        <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.85, borderLeft: `2px solid ${role.color}50`, paddingLeft: 12, whiteSpace: "pre-wrap" }}>
          <AIText text={currentResponse}/>
        </div>
        <div style={{ fontFamily: C.mono, fontSize: 9, color: C.textDimmer, marginTop: 8, letterSpacing: "0.04em" }}>
          AI-generated · not reviewed by a person
        </div>
        </div>
      )}

      {!loading && !currentResponse && !error && (
        <div style={{ fontFamily: C.mono, fontSize: 11, color: C.textDimmer, lineHeight: 1.7 }}>
          Select a role above, then hit "◉ ask" to generate the questions this stakeholder would bring to the {node.label} node — the ones that don't usually make it into the governance document.
        </div>
      )}
    </div>
  );
}

function NodeDetail({ nodeId }) {
  const node = TAXONOMY_NODES.find(n => n.id === nodeId);
  if (!node) return <div style={{ padding: 24, color: C.textDimmer, fontFamily: C.mono, fontSize: 12 }}>Select a node</div>;
  return (
    <NodeBody
      node={node} C={C} loopMeta={LOOP_META} docLibrary={DOC_LIBRARY}
      aiPanels={<><AICurationPanel node={node}/><FacetiousCollaborator node={node}/></>}
    />
  );
}

// Private review queue for visitor contributions (sources, questions, notes,
// tools). Two independent AI reads recommend; Lindsay decides. When both agree,
// one click accepts the consensus. When they split, she breaks the tie.
function SuggestionQueue({ password }) {
  const [items, setItems] = useState(null);
  const [unreviewed, setUnreviewed] = useState(0);
  const [stats, setStats] = useState({});
  const [reasons, setReasons] = useState({});
  const [overrule, setOverrule] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [loading, setLoading] = useState(false);
  const [published, setPublished] = useState(null);
  const [showPublished, setShowPublished] = useState(false);
  const loadPublished = async () => {
    try {
      const r = await fetch("/api/queue?view=published", { headers: { "x-intake-password": password } });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `Error ${r.status}`);
      setPublished(d.items);
    } catch (e) { setError(e.message); }
  };
  const unpublish = async it => {
    setBusy(it.id);
    try {
      const r = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-intake-password": password },
        body: JSON.stringify({ action: "unpublish", nodeId: it.nodeId, id: it.id, reason: reasons[it.id] || "other" }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || `Error ${r.status}`); }
      await loadPublished();
    } catch (e) { setError(e.message); }
    setBusy(null);
  };
  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/queue", { headers: { "x-intake-password": password } });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `Error ${r.status}`);
      setItems(d.items); setUnreviewed(d.unreviewed || 0); setStats(d.stats || {}); setError(null);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };
  useEffect(() => { if (password) load(); }, [password]);
  // Keep fetching while AI reviews are still being filled in, a few per request.
  useEffect(() => {
    if (unreviewed > 0 && !loading) { const t = setTimeout(load, 1500); return () => clearTimeout(t); }
  }, [unreviewed, loading]);

  const decide = async (id, action, reason) => {
    setBusy(id);
    try {
      const r = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-intake-password": password },
        body: JSON.stringify({ id, action, reason }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || `Error ${r.status}`); }
      await load();
    } catch (e) { setError(e.message); }
    setBusy(null);
  };

  const nodeLabel = id => TAXONOMY_NODES.find(n => n.id === id)?.label || id;
  const kindColor = { source: C.internal, question: C.handoff, note: C.commons, tool: C.external };
  const verdictColor = v => (v === "approve" ? C.external : v === "reject" ? C.red : C.textDim);
  const btn = (col, solid) => ({ fontFamily: C.mono, fontSize: 10, padding: "4px 10px", borderRadius: 3, cursor: "pointer", background: solid ? col + "20" : "transparent", border: `1px solid ${solid ? col + "60" : C.border}`, color: solid ? col : C.textDim });
  const REASON_LIST = ["spam", "promotional", "off-topic", "low-quality", "duplicate", "unsafe", "other"];
  const reasonPicker = (id, required) => (
    <select aria-label="Reason for rejecting" value={reasons[id] || ""} onChange={e => setReasons(r => ({ ...r, [id]: e.target.value }))} style={{ fontFamily: C.mono, fontSize: 10, background: C.surface3, color: C.textDim, border: `1px solid ${C.border}`, borderRadius: 3 }}>
      <option value="">{required ? "reason…" : "reason (optional)"}</option>
      {REASON_LIST.map(r => <option key={r} value={r}>{r}</option>)}
    </select>
  );
  const manualButtons = (it, requireReason) => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <button disabled={busy === it.id} onClick={() => decide(it.id, "approve")} style={btn(C.external, true)}>approve · publish</button>
      {reasonPicker(it.id, requireReason)}
      <button disabled={busy === it.id || (requireReason && !reasons[it.id])} onClick={() => decide(it.id, "reject", reasons[it.id] || undefined)} style={btn(C.red, false)}>reject · delete</button>
    </div>
  );

  return (
    <div style={{ marginBottom: 24, padding: 14, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontFamily: C.mono, fontSize: 10, letterSpacing: "0.1em", color: C.commons, fontWeight: 700 }}>
          REVIEW QUEUE {items ? `(${items.length})` : ""}{unreviewed > 0 ? ` · ${unreviewed} being read…` : ""}
        </div>
        <button onClick={load} style={btn(C.textDim, false)}>refresh</button>
      </div>
      {error && <div style={{ fontFamily: C.mono, fontSize: 11, color: C.red, marginBottom: 8 }}>{error}</div>}
      <QueueStats stats={stats} />
      {items && items.length === 0 && <div style={{ fontFamily: C.mono, fontSize: 11, color: C.textDim }}>Nothing waiting. Contributions from node pages show up here.</div>}
      {(items || []).map(it => {
        const rv = it.review;
        const cons = rv?.consensus;
        const agreed = cons === "approve" || cons === "reject";
        const consReason = cons === "reject" ? (rv.fit?.reason || rv.skeptic?.reason || "other") : undefined;
        return (
          <div key={it.id} style={{ borderTop: `1px solid ${C.border}`, padding: "12px 0", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontFamily: C.mono, fontSize: 10, color: C.textDim }}>
              <span style={{ color: kindColor[it.kind] || C.text, fontWeight: 700 }}>{it.kind.toUpperCase()}</span> · {nodeLabel(it.nodeId)} · {new Date(it.submittedAt).toLocaleString()}
            </div>
            <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{it.text}</div>
            {it.url && <a href={it.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: C.mono, fontSize: 11, color: C.internal, wordBreak: "break-all" }}>{it.url}</a>}
            {it.kind === "note" && <div style={{ fontFamily: C.mono, fontSize: 10, color: C.textDim }}>Publishes as: {[it.name || "Anonymous practitioner", it.role && `${it.role} (self-described)`].filter(Boolean).join(" · ")}</div>}

            {!rv || cons === null ? (
              <div style={{ fontFamily: C.mono, fontSize: 10.5, color: C.textDim }}>
                {rv && (rv.fit?.error || rv.skeptic?.error) ? `AI review failed (${rv.fit?.error || rv.skeptic?.error}); retrying on refresh. You can decide without it.` : "AI reviewers are reading this…"}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 10px", background: C.surface3, borderRadius: 4 }}>
                {[["Reviewer 1 · fit", rv.fit], ["Reviewer 2 · skeptic", rv.skeptic]].map(([who, r]) => (
                  <div key={who} style={{ fontSize: 12, color: C.textDim, lineHeight: 1.5 }}>
                    <span style={{ fontFamily: C.mono, fontSize: 10 }}>{who}: </span>
                    <span style={{ fontFamily: C.mono, fontSize: 10, color: verdictColor(r.verdict), fontWeight: 700 }}>{r.verdict}{r.reason ? ` · ${r.reason}` : ""}</span>
                    <span> · {r.rationale}</span>
                  </div>
                ))}
              </div>
            )}

            {agreed && !overrule[it.id] ? (
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontFamily: C.mono, fontSize: 10, color: verdictColor(cons) }}>Both recommend {cons}.</span>
                <button disabled={busy === it.id} onClick={() => decide(it.id, cons, consReason)} style={btn(verdictColor(cons), true)}>
                  accept consensus · {cons === "approve" ? "publish" : "delete"}
                </button>
                <button onClick={() => setOverrule(o => ({ ...o, [it.id]: true }))} style={{ ...btn(C.textDim, false), border: "none", textDecoration: "underline" }}>overrule</button>
              </div>
            ) : cons === "split" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontFamily: C.mono, fontSize: 10, color: C.handoff }}>Reviewers split. Your call.</span>
                {manualButtons(it, true)}
              </div>
            ) : (
              manualButtons(it, agreed /* overruling a consensus: a reject needs a reason */)
            )}
          </div>
        );
      })}
      <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 8, paddingTop: 10 }}>
        <button onClick={() => { const next = !showPublished; setShowPublished(next); if (next) loadPublished(); }} style={btn(C.textDim, false)}>
          {showPublished ? "hide published" : "show published contributions"}
        </button>
        {showPublished && published && published.length === 0 && <div style={{ fontFamily: C.mono, fontSize: 11, color: C.textDim, marginTop: 8 }}>Nothing published yet.</div>}
        {showPublished && (published || []).map(it => (
          <div key={it.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontFamily: C.mono, fontSize: 10, color: kindColor[it.kind] || C.text, fontWeight: 700 }}>{it.kind.toUpperCase()}</span>
            <span style={{ fontFamily: C.mono, fontSize: 10, color: C.textDim }}>{nodeLabel(it.nodeId)}</span>
            <span style={{ fontSize: 12, color: C.text, flex: "1 1 240px", minWidth: 0 }}>{(it.text || "").slice(0, 140)}{(it.text || "").length > 140 ? "…" : ""}</span>
            {reasonPicker(it.id, false)}
            <button disabled={busy === it.id} onClick={() => unpublish(it)} style={btn(C.red, false)}>unpublish</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Running record for the auto-approval decision: counts only, never content.
function QueueStats({ stats }) {
  const n = k => parseInt(stats[k] || "0", 10);
  const kinds = ["source", "tool", "question", "note"];
  const reviewed = n("reviewed");
  if (!reviewed && !kinds.some(k => n(`submitted:${k}`))) return null;
  const domains = prefix => Object.entries(stats).filter(([k]) => k.startsWith(prefix))
    .map(([k, v]) => [k.slice(prefix.length), parseInt(v, 10)]).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const cell = { fontFamily: C.mono, fontSize: 10.5, color: C.textDim, padding: "3px 8px 3px 0" };
  const refused = Object.entries(stats).filter(([k]) => k.startsWith("refused:") || k.startsWith("bot:"));
  return (
    <div style={{ marginBottom: 12, padding: 10, border: `1px dashed ${C.border}`, borderRadius: 4 }}>
      <div style={{ fontFamily: C.mono, fontSize: 9, letterSpacing: "0.1em", color: C.textDim, marginBottom: 6 }}>RECORD FOR THE AUTO-APPROVAL DECISION</div>
      <table style={{ borderCollapse: "collapse" }}><tbody>
        <tr><td style={cell}></td>{kinds.map(k => <td key={k} style={cell}>{k}</td>)}</tr>
        {["submitted", "approved", "rejected"].map(row => (
          <tr key={row}><td style={cell}>{row}</td>{kinds.map(k => <td key={k} style={{ ...cell, color: C.text }}>{n(`${row}:${k}`)}</td>)}</tr>
        ))}
      </tbody></table>
      <div style={{ ...cell, marginTop: 6 }}>
        Avg time to review: {reviewed ? `${Math.round(n("review-hours:total") / reviewed)} h` : "—"}
        {refused.length > 0 && <> · Refused before review: {refused.map(([k, v]) => `${k.replace(/^(refused:|bot:)/, "").replace("screen:", "")} ${v}`).join(", ")}</>}
      </div>
      {domains("approved:domain:").length > 0 && <div style={cell}>Approved source domains: {domains("approved:domain:").map(([d, v]) => `${d} (${v})`).join(", ")}</div>}
      {domains("rejected:domain:").length > 0 && <div style={cell}>Rejected source domains: {domains("rejected:domain:").map(([d, v]) => `${d} (${v})`).join(", ")}</div>}
      {domains("rejected:reason:").length > 0 && <div style={cell}>Reject reasons: {domains("rejected:reason:").map(([d, v]) => `${d} ${v}`).join(", ")}</div>}
      {(n("consensus:approve") + n("consensus:reject") + n("consensus:split")) > 0 && (
        <div style={cell}>
          AI reviewers: agreed to approve {n("consensus:approve")} · agreed to reject {n("consensus:reject")} · split {n("consensus:split")}.
          {" "}You overrode a consensus {["source", "tool", "question", "note"].reduce((t, k) => t + n(`overrode:${k}`), 0)} times.
          {n("consensus:split") > 0 && <> On splits you sided with fit {n("split:sided-with:fit")}, skeptic {n("split:sided-with:skeptic")}.</>}
        </div>
      )}
    </div>
  );
}

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

  const loadDocs = async (pwd) => {
    setLoadingDocs(true);
    try {
      const res = await fetch("/api/documents", {
        headers: { "x-intake-password": pwd },
      });
      if (res.status === 401) { setUnlocked(false); setPasswordError(true); return; }
      const data = await res.json();
      setUserDocs(data.documents || []);
    } catch (e) {}
    finally { setLoadingDocs(false); }
  };

  const handleUnlock = async () => {
    setPasswordError(false);
    const res = await fetch("/api/documents", { headers: { "x-intake-password": passwordInput } });
    if (res.status === 401) { setPasswordError(true); return; }
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
    setLoading(true); setResult(null); setError(null);

    const allDocsSummary = [
      existingLibrarySummary,
      ...userDocs.map(d => `[user:${d.title}] ${d.title} (${d.source}, ${d.year}) — ${(d.abstract||"").slice(0,120)}…`)
    ].join("\n");

    try {
      let userContent;
      if (mode === "file" && fileData) {
        userContent = [
          { type: "document", source: { type: "base64", media_type: fileData.mediaType, data: fileData.base64 } },
          { type: "text", text: `EXISTING LIBRARY:\n${allDocsSummary}\n\nTAXONOMY NODES:\n${nodeList}\n\nAnalyze this document and return the JSON.` },
        ];
      } else {
        userContent = `EXISTING LIBRARY:\n${allDocsSummary}\n\nTAXONOMY NODES:\n${nodeList}\n\n${mode === "url" ? "URL" : "TEXT"}:\n${input}`;
      }

      const res = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-intake-password": sessionPassword },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2500,
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
          messages: [{ role: "user", content: userContent }],
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
        headers: { "Content-Type": "application/json", "x-intake-password": sessionPassword },
        body: JSON.stringify({ ...result, sourceInput: input }),
      });
      if (!res.ok) throw new Error("Save failed");
      await loadDocs(sessionPassword);
      setResult(null); setInput("");
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (index) => {
    try {
      await fetch("/api/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-intake-password": sessionPassword },
        body: JSON.stringify({ index }),
      });
      await loadDocs(sessionPassword);
    } catch (e) {}
  };

  const handlePromote = async (index) => {
    try {
      await fetch("/api/documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-intake-password": sessionPassword },
        body: JSON.stringify({ index }),
      });
      await loadDocs(sessionPassword);
    } catch (e) {}
  };

  if (!unlocked) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", padding: 40 }}>
        <div style={{ width: 340, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: 28 }}>
          <div style={{ fontFamily: C.serif, fontSize: 18, color: C.text, marginBottom: 6 }}>Private Workspace</div>
          <div style={{ fontFamily: C.mono, fontSize: 11, color: C.textDimmer, lineHeight: 1.6, marginBottom: 20 }}>
            Document intake is private. Enter your workspace password to continue.
          </div>
          <input
            type="password" value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleUnlock()}
            placeholder="Password"
            style={{
              width: "100%", padding: "9px 12px", borderRadius: 4, marginBottom: 10,
              background: C.surface3, border: `1px solid ${passwordError ? C.red : C.border}`,
              color: C.text, fontFamily: C.mono, fontSize: 12, outline: "none",
            }}
          />
          {passwordError && <div style={{ fontFamily: C.mono, fontSize: 10, color: C.red, marginBottom: 8 }}>Incorrect password</div>}
          <button onClick={handleUnlock} style={{
            width: "100%", padding: "9px", borderRadius: 4, cursor: "pointer",
            background: C.commons + "20", border: `1px solid ${C.commons}50`,
            color: C.commons, fontFamily: C.mono, fontSize: 11, fontWeight: 700,
          }}>Unlock →</button>
        </div>
      </div>
    );
  }

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

      <SuggestionQueue password={sessionPassword} />

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
        <input value={input} onChange={e => setInput(e.target.value)}
          placeholder="https://pubmed.ncbi.nlm.nih.gov/... or any URL"
          style={{ width: "100%", padding: "10px 14px", borderRadius: 4, background: C.surface2, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.mono, fontSize: 12, outline: "none", marginBottom: 12 }}
        />
      )}

      {mode === "paste" && (
        <textarea value={input} onChange={e => setInput(e.target.value)}
          placeholder="Paste abstract, notes, or any text about the document…" rows={8}
          style={{ width: "100%", padding: "10px 14px", borderRadius: 4, background: C.surface2, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.mono, fontSize: 12, outline: "none", resize: "vertical", marginBottom: 12 }}
        />
      )}

      {mode === "file" && (
        <div style={{ width: "100%", padding: "20px 14px", borderRadius: 4, marginBottom: 12, background: C.surface2, border: `1px dashed ${fileData ? C.external : C.border}`, textAlign: "center", cursor: "pointer" }}
          onClick={() => document.getElementById("file-upload-input").click()}>
          <input id="file-upload-input" type="file" accept=".pdf,.txt,.md" onChange={handleFileSelect} style={{ display: "none" }} />
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
        <div style={{ padding: "10px 14px", background: C.redDim, border: `1px solid ${C.red}30`, borderRadius: 4, fontFamily: C.mono, fontSize: 11, color: C.red, marginBottom: 16 }}>{error}</div>
      )}

      {result && (
        <div style={{ background: C.surface2, border: `1px solid ${C.borderBright}`, borderRadius: 6, overflow: "hidden", marginBottom: 24 }}>
          <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontFamily: C.mono, fontSize: 9, color: C.handoff, background: C.handoffDim, border: `1px solid ${C.handoff}30`, borderRadius: 2, padding: "2px 6px", fontWeight: 700 }}>{result.type?.toUpperCase()}</span>
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
                <div style={{ fontSize: 11.5, color: C.textDim, lineHeight: 1.6, marginBottom: 4 }}><strong style={{ color: C.text }}>Already covered by:</strong> {result.overlap.overlappingDocs?.join(", ")}</div>
                <div style={{ fontSize: 11.5, color: C.textDim, lineHeight: 1.6, marginBottom: 4 }}><strong style={{ color: C.text }}>Overlap:</strong> {result.overlap.overlapSummary}</div>
                <div style={{ fontSize: 11.5, color: C.textDim, lineHeight: 1.6 }}><strong style={{ color: C.external }}>What's new:</strong> {result.overlap.whatIsNew}</div>
              </>
            ) : (
              <div style={{ fontSize: 11.5, color: C.textDim, lineHeight: 1.6 }}>This document covers ground not yet in the library. Worth adding.</div>
            )}
          </div>
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontFamily: C.mono, fontSize: 9, color: C.external, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>ROUTES TO</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {result.suggestedNodes?.map(nid => {
                const node = TAXONOMY_NODES.find(n => n.id === nid);
                if (!node) return null;
                const lm = LOOP_META[node.loop];
                return <span key={nid} style={{ padding: "3px 9px", borderRadius: 3, background: lm.color + "15", border: `1px solid ${lm.color}35`, color: lm.color, fontFamily: C.mono, fontSize: 10 }}>{node.icon} {node.label}</span>;
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

      {loadingDocs ? (
        <div style={{ fontFamily: C.mono, fontSize: 11, color: C.textDimmer }}>Loading your library…</div>
      ) : userDocs.length > 0 && (
        <div>
          <div style={{ fontFamily: C.mono, fontSize: 9, color: C.textDimmer, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 10 }}>YOUR LIBRARY ({userDocs.length} documents)</div>
          {userDocs.map((d, i) => (
            <div key={i} style={{ padding: "10px 14px", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 4, marginBottom: 6, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: C.mono, fontSize: 9, color: C.handoff, background: C.handoffDim, border: `1px solid ${C.handoff}30`, borderRadius: 2, padding: "1px 5px", fontWeight: 700 }}>{d.type?.toUpperCase()}</span>
                  <span style={{ fontFamily: C.mono, fontSize: 10, color: C.textDim }}>{d.source} · {d.year}</span>
                  <span style={{ fontFamily: C.mono, fontSize: 9, color: C.textDimmer }}>{new Date(d.addedAt).toLocaleDateString()}</span>
                </div>
                <div style={{ fontSize: 12.5, color: C.text, marginBottom: 4 }}>{d.title}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {d.suggestedNodes?.map(nid => {
                    const node = TAXONOMY_NODES.find(n => n.id === nid);
                    if (!node) return null;
                    return <span key={nid} style={{ fontFamily: C.mono, fontSize: 9, color: LOOP_META[node.loop].color, background: LOOP_META[node.loop].color + "10", border: `1px solid ${LOOP_META[node.loop].color}25`, borderRadius: 2, padding: "1px 5px" }}>{node.icon} {node.label}</span>;
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
  // A node page's "Evidence & Tools →" link arrives as /#taxonomy-<nodeId>.
  const incomingNode = (() => {
    const m = window.location.hash.match(/^#taxonomy-([\w-]+)$/);
    const id = m ? m[1] : null;
    return id && TAXONOMY_NODES.some(n => n.id === id) ? id : null;
  })();
  const [activeLayer, setActiveLayer] = useState(incomingNode ? "taxonomy" : "home");
  const [activeNodeId, setActiveNodeId] = useState(incomingNode || "stop");
  const [loopFilter, setLoopFilter] = useState("all");
  const [menuOpen, setMenuOpen] = useState(false);
  const [nodeNavOpen, setNodeNavOpen] = useState(window.innerWidth <= 1024);

  const handleNavigate = (layer, nodeId) => {
    setActiveLayer(layer);
    if (nodeId) setActiveNodeId(nodeId);
  };

  // Standalone node page: /nodes/<id> renders the same NodeBody as the Taxonomy tab.
  const pageNodeId = (window.location.pathname.match(/^\/nodes\/([\w-]+?)(?:\.html)?\/?$/) || [])[1];
  const pageNode = pageNodeId && TAXONOMY_NODES.find(n => n.id === pageNodeId);
  if (pageNodeId) {
    return (
      <div style={{ background: C.bg, minHeight: "100vh", color: C.text }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600&display=swap'); body { margin: 0; background: ${C.bg}; } a:focus-visible, button:focus-visible { outline: 2px solid ${C.commons}; outline-offset: 2px; }`}</style>
        <div style={{ padding: "7px 20px", background: C.handoffDim, borderBottom: `1px solid ${C.border}`, fontFamily: C.mono, fontSize: 10.5, color: C.textDim, lineHeight: 1.5 }}>
          <span style={{ color: C.handoff }}>WORKING PROTOTYPE</span> · built by one person · AI answers are generated, not reviewed · <a href="/privacy" style={{ color: C.textDim }}>what's live</a>
        </div>
        <nav style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", padding: "12px 20px", borderBottom: `1px solid ${C.border}`, background: C.surface, fontFamily: C.mono, fontSize: 11 }}>
          <a href="/" style={{ color: C.text, textDecoration: "none", fontFamily: C.serif, fontSize: 16 }}>Governance Commons</a>
          <a href="/" style={{ color: C.textDim, textDecoration: "none" }}>← Map</a>
          {pageNode && <a href={`/#taxonomy-${pageNode.id}`} style={{ color: C.textDim, textDecoration: "none" }}>All nodes</a>}
          <a href="/tools" style={{ color: C.textDim, textDecoration: "none" }}>Tools</a>
        </nav>
        {pageNode ? (
          <NodeBody
            node={pageNode} C={C} loopMeta={LOOP_META} docLibrary={DOC_LIBRARY}
            aiPanels={<><AICurationPanel node={pageNode}/><FacetiousCollaborator node={pageNode}/></>}
          />
        ) : (
          <div style={{ padding: 40, fontFamily: C.mono, fontSize: 13, color: C.textDim }}>
            No node called "{pageNodeId}". <a href="/" style={{ color: C.commons }}>Back to the map</a>.
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, display: "flex", flexDirection: "column" }}>

{/* Top bar */}
      <div style={{ padding: "7px 24px", background: C.handoffDim, borderBottom: `1px solid ${C.border}`, fontFamily: C.mono, fontSize: 10.5, color: C.textDim, letterSpacing: "0.03em", lineHeight: 1.5, flexShrink: 0 }}>
        <span style={{ color: C.handoff }}>WORKING PROTOTYPE</span> · built by one person · AI answers are generated, not reviewed · registry submissions and file uploads are paused · <a href="/privacy" style={{ color: C.textDim }}>what's live</a>
      </div>
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "16px 24px", display: "flex", alignItems: "center", gap: 20, background: C.surface, flexShrink: 0, flexWrap: "wrap" }} className="topbar">
        <div>
          <div style={{ fontFamily: C.serif, fontSize: 18, fontWeight: 400, color: C.text, letterSpacing: "0.01em" }}>Governance Commons</div>
          <div style={{ fontFamily: C.mono, fontSize: 10, color: C.textDimmer, letterSpacing: "0.08em", marginTop: 2 }}>CLINICAL AI GOVERNANCE INFRASTRUCTURE · LIVING MAP</div>
        </div>

        {/* Desktop nav — hidden on mobile */}
        <div className="desktop-nav" style={{ display: "flex", gap: 2, marginLeft: "auto" }}>
          {[
            { id: "home",     label: "◉ Map" },          
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

        {/* Desktop external links — hidden on mobile */}
        <div className="desktop-nav" style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <a href="/community-weaving" style={{
            padding: "7px 14px", borderRadius: 4, cursor: "pointer",
            background: "transparent",
            border: `1px solid ${C.commons}40`,
            color: C.commons,
            fontFamily: C.mono, fontSize: 10, fontWeight: 400,
            letterSpacing: "0.05em",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}>Community Weaving →</a>
          <a href="/tools" style={{
            padding: "7px 14px", borderRadius: 4, cursor: "pointer",
            background: "transparent",
            border: `1px solid #7ef7c040`,
            color: "#7ef7c0",
            fontFamily: C.mono, fontSize: 10, fontWeight: 400,
            letterSpacing: "0.05em",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}>Tools →</a>
        </div>

        {/* Desktop loop filter pills — hidden on mobile */}
        {activeLayer === "taxonomy" && (
          <div className="desktop-nav" style={{ display: "flex", gap: 4 }}>
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

        {/* Hamburger button — mobile only */}
        <button
          className="hamburger-btn"
          onClick={() => setMenuOpen(o => !o)}
          style={{
            display: "none",
            marginLeft: "auto",
            background: "transparent",
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            color: C.text,
            fontFamily: C.mono,
            fontSize: 18,
            width: 40,
            height: 36,
            cursor: "pointer",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >{menuOpen ? "✕" : "☰"}</button>

        {/* Mobile drawer */}
        {menuOpen && (
          <div className="mobile-drawer" style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
          }}>
            {/* Backdrop */}
            <div
              onClick={() => setMenuOpen(false)}
              style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)" }}
            />
            {/* Panel */}
            <div style={{
              position: "relative",
              zIndex: 1,
              background: C.surface,
              borderBottom: `1px solid ${C.border}`,
              padding: "16px 20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontFamily: C.mono, fontSize: 9, color: C.textDimmer, letterSpacing: "0.12em", textTransform: "uppercase" }}>Navigation</div>
                <button onClick={() => setMenuOpen(false)} style={{
                  background: "transparent", border: "none", color: C.textDim,
                  fontFamily: C.mono, fontSize: 16, cursor: "pointer", padding: "4px 8px",
                }}>✕</button>
              </div>

              {/* Tab buttons */}
              {[
                { id: "home",     label: "◉ Map" },
                { id: "docs",     label: "① Doc Repository" },
                { id: "taxonomy", label: "② Taxonomy Navigator" },
                { id: "matrix",   label: "③ Commons Matrix" },
                { id: "intake",   label: "④ Add Document" },
              ].map(tab => (
                <button key={tab.id} onClick={() => { setActiveLayer(tab.id); setMenuOpen(false); }} style={{
                  padding: "11px 14px", borderRadius: 4, cursor: "pointer", textAlign: "left",
                  background: activeLayer === tab.id ? C.commons + "20" : C.surface2,
                  border: `1px solid ${activeLayer === tab.id ? C.commons + "60" : C.border}`,
                  color: activeLayer === tab.id ? C.commons : C.textDim,
                  fontFamily: C.mono, fontSize: 12, fontWeight: activeLayer === tab.id ? 700 : 400,
                  letterSpacing: "0.05em",
                }}>{tab.label}</button>
              ))}

              {/* Divider */}
              <div style={{ borderTop: `1px solid ${C.border}`, margin: "4px 0" }} />

              {/* External links */}
              <a href="/community-weaving" style={{
                padding: "11px 14px", borderRadius: 4, display: "block",
                background: C.surface2, border: `1px solid ${C.commons}40`,
                color: C.commons, fontFamily: C.mono, fontSize: 12,
                textDecoration: "none", letterSpacing: "0.05em",
              }}>Community Weaving →</a>
              <a href="/tools" style={{
                padding: "11px 14px", borderRadius: 4, display: "block",
                background: C.surface2, border: `1px solid #7ef7c040`,
                color: "#7ef7c0", fontFamily: C.mono, fontSize: 12,
                textDecoration: "none", letterSpacing: "0.05em",
              }}>Tools →</a>

              {/* Loop filter pills — only if taxonomy active */}
              {activeLayer === "taxonomy" && (
                <>
                  <div style={{ borderTop: `1px solid ${C.border}`, margin: "4px 0" }} />
                  <div style={{ fontFamily: C.mono, fontSize: 9, color: C.textDimmer, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>Filter by loop</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {["all", "internal", "handoff", "external", "commons"].map(f => {
                      const color = f === "all" ? C.textDim : LOOP_META[f]?.color;
                      return (
                        <button key={f} onClick={() => { setLoopFilter(f); setMenuOpen(false); }} style={{
                          padding: "6px 12px", borderRadius: 3, cursor: "pointer",
                          background: loopFilter === f ? color + "20" : C.surface3,
                          border: `1px solid ${loopFilter === f ? color + "50" : C.border}`,
                          color: loopFilter === f ? color : C.textDimmer,
                          fontFamily: C.mono, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
                        }}>{f}</button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {activeLayer === "home" && (
  <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
    <div style={{ padding: "20px 32px 12px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
      <div style={{ fontFamily: C.serif, fontSize: 28, fontWeight: 400, color: C.text, marginBottom: 4 }}>
        Clinical AI Governance Infrastructure
      </div>
      <div style={{ fontFamily: C.mono, fontSize: 11, color: C.textDimmer, letterSpacing: "0.08em" }}>
        Select a node to explore the governance architecture — each one leads to its knowledge base, evidence, and tools.
      </div>
    </div>
    <div style={{ flex: 1, minHeight: 0 }}>
      <ConstellationMap onSelectNode={(id) => {
        window.location.href = `/nodes/${id}`;
      }} />
    </div>
  </div>
)}
        {activeLayer === "docs" && (
          <div style={{ flex: 1, overflowY: "auto" }}>
            <DocRepository onNavigate={handleNavigate}/>
          </div>
        )}

{activeLayer === "taxonomy" && (
          <>
            {/* Desktop sidebar */}
            <div className="taxonomy-sidebar" style={{ width: 280, flexShrink: 0, borderRight: `1px solid ${C.border}`, overflowY: "auto", background: C.surface }}>
              <TaxonomyNavigator activeNodeId={activeNodeId} onSelectNode={id => setActiveNodeId(id)} loopFilter={loopFilter}/>
            </div>

            {/* Node detail + mobile sticky nav bar */}
            <div className="taxonomy-content" style={{ flex: 1, overflowY: "auto", position: "relative" }}>

              {/* Mobile sticky browse bar */}
              <div className="mobile-node-bar" style={{
                display: "none",
                position: "sticky",
                top: 0,
                zIndex: 50,
                background: C.surface,
                borderBottom: `1px solid ${C.border}`,
                padding: "10px 16px",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}>
                {(() => {
                  const node = TAXONOMY_NODES.find(n => n.id === activeNodeId);
                  const lm = node ? LOOP_META[node.loop] : null;
                  return node ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                      <span style={{ fontFamily: C.mono, fontSize: 14, color: lm.color, flexShrink: 0 }}>{node.icon}</span>
                      <span style={{ fontSize: 12, color: C.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.label}</span>
                    </div>
                  ) : null;
                })()}
                <button
                  onClick={() => setNodeNavOpen(true)}
                  style={{
                    background: C.surface2,
                    border: `1px solid ${C.borderBright}`,
                    borderRadius: 4,
                    color: C.text,
                    fontFamily: C.mono,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    padding: "6px 12px",
                    cursor: "pointer",
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                  }}
                >☰ Browse Nodes</button>
              </div>

              <NodeDetail nodeId={activeNodeId}/>
            </div>

            {/* Mobile node navigator overlay */}
            {nodeNavOpen && (
              <div style={{
                position: "fixed",
                inset: 0,
                zIndex: 200,
                display: "flex",
                flexDirection: "column",
              }}>
                {/* Backdrop */}
                <div
                  onClick={() => setNodeNavOpen(false)}
                  style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)" }}
                />
                {/* Panel — full height, scrollable */}
                <div style={{
                  position: "relative",
                  zIndex: 1,
                  background: C.surface,
                  width: "100%",
                  maxHeight: "90vh",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  marginTop: "auto",
                  borderTop: `1px solid ${C.borderBright}`,
                  borderRadius: "12px 12px 0 0",
                }}>
                  {/* Handle + header */}
                  <div style={{
                    padding: "14px 20px 10px",
                    borderBottom: `1px solid ${C.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexShrink: 0,
                    position: "sticky",
                    top: 0,
                    background: C.surface,
                    zIndex: 1,
                  }}>
                    <div style={{ fontFamily: C.mono, fontSize: 9, color: C.textDimmer, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                      Taxonomy Navigator
                    </div>
                    <button
                      onClick={() => setNodeNavOpen(false)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: C.textDim,
                        fontFamily: C.mono,
                        fontSize: 16,
                        cursor: "pointer",
                        padding: "4px 8px",
                      }}
                    >✕</button>
                  </div>

                  {/* Loop filter pills */}
                  <div style={{
                    padding: "10px 16px",
                    borderBottom: `1px solid ${C.border}`,
                    display: "flex",
                    gap: 6,
                    flexWrap: "wrap",
                    flexShrink: 0,
                  }}>
                    {["all", "internal", "handoff", "external", "commons"].map(f => {
                      const color = f === "all" ? C.textDim : LOOP_META[f]?.color;
                      return (
                        <button key={f} onClick={() => setLoopFilter(f)} style={{
                          padding: "5px 10px", borderRadius: 3, cursor: "pointer",
                          background: loopFilter === f ? color + "20" : C.surface2,
                          border: `1px solid ${loopFilter === f ? color + "50" : C.border}`,
                          color: loopFilter === f ? color : C.textDimmer,
                          fontFamily: C.mono, fontSize: 9, fontWeight: 700,
                          textTransform: "uppercase", letterSpacing: "0.08em",
                        }}>{f}</button>
                      );
                    })}
                  </div>

                  {/* Navigator — reuses existing component */}
                  <div style={{ flex: 1, overflowY: "auto" }}>
                    <TaxonomyNavigator
                      activeNodeId={activeNodeId}
                      onSelectNode={id => {
                        setActiveNodeId(id);
                        setNodeNavOpen(false);
                      }}
                      loopFilter={loopFilter}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeLayer === "matrix" && (
          <div style={{ flex: 1, overflowY: "auto" }}>
            <MatrixBridge linkedConcept="stop"/>
          </div>
        )}

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

        /* ── MOBILE RESPONSIVE ── */
        @media (max-width: 1024px) {
          .desktop-nav { display: none !important; }
          .hamburger-btn { display: flex !important; }
          .topbar { padding: 12px 16px !important; }
        }

/* Taxonomy sidebar collapses on mobile, browse bar appears */
        @media (max-width: 1024px) {
          .taxonomy-sidebar { display: none !important; }
          .taxonomy-content { padding: 0 !important; }
          .mobile-node-bar { display: flex !important; }
        }

        /* Node detail panels get breathing room on mobile */
        @media (max-width: 480px) {
          .topbar { gap: 10px !important; }
        }
      `}</style>
    </div>
  );
}
