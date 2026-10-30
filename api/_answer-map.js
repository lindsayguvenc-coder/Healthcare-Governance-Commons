// api/_answer-map.js
// Translates questionnaire answers (ids like q2_usetype, q19_owner) into the keys the
// engines read (Q2, Q28, Q36, ...). Before this layer existed, only Q15/Q16/Q17 reached
// the engines, so generated protocols fell back to defaults for almost everything.
// Underscore prefix: Vercel does not expose this file as an API route.
// CommonJS on purpose: api/package.json declares "type": "commonjs".
//
// Rules: never overwrite a key that is already present (direct callers keep working),
// and only map what a question actually answers. Engine keys with no matching question
// are left empty on purpose so the engines raise their gap flags.

const startsYes = (v) => typeof v === "string" && v.startsWith("Yes");
const defined = (v) => typeof v === "string" && v.trim() !== "" && !v.startsWith("Not yet") && !v.startsWith("Unknown") && !v.startsWith("Unsure");

const USE_TYPE_MAP = [
  ["Triage / prioritization", "triage_prioritization"],
  ["Decision support at point of care", "clinical_decision_support"],
  ["Risk stratification", "risk_stratification"],
  ["Workflow routing", "workflow_prioritization"],
  ["Screening / flagging", "screening_flagging"],
  ["Retrospective audit", "retrospective_audit"],
  ["Documentation / generative drafting", "generative_documentation"],
  ["Agentic workflow", "agentic_workflow"],
];

// Decision window implied by the use type (the questionnaire has no direct question)
const DECISION_WINDOW = {
  triage_prioritization: "minutes",
  clinical_decision_support: "real_time",
  agentic_workflow: "minutes",
};

const PREVALENCE_BANDS = {
  "Less than 5%": 2.5,
  "5 — 15%": 10,
  "15 — 30%": 22.5,
  "Greater than 30%": 40,
};

function mapUseType(label) {
  if (!label) return null;
  const hit = USE_TYPE_MAP.find(([prefix]) => label.startsWith(prefix));
  return hit ? hit[1] : null;
}

function pct(label) {
  if (!defined(label)) return null;
  const n = parseFloat(label);
  return Number.isFinite(n) ? n : null;
}

function localRecording(a) {
  const recorded = [], inconsistent = [];
  const rec = (axis, value, inconsistentWhen = []) => {
    if (!defined(value) || /Not consistently recorded|Not currently recorded|not captured|not systematically/i.test(value)) return;
    recorded.push(axis);
    if (inconsistentWhen.some((p) => value.startsWith(p))) inconsistent.push(axis);
  };
  if (defined(a.q30_age)) recorded.push("age");
  rec("sex_gender", a.q31_sex_record, ["Varies", "Under review"]);
  rec("race_ethnicity", a.q32_race_record, ["Combined", "Limited", "Varies"]);
  rec("language", a.q34_lang_record, ["Yes — inconsistently", "Varies"]);
  rec("social_determinants", a.q33_sdoh_structured, ["Partially"]);
  rec("socioeconomic", a.q35_payer);
  rec("geography", a.q36_geo);
  if (a.q39_comorbidity && a.q39_comorbidity.trim()) recorded.push("comorbidity");
  return { recorded, inconsistent };
}

function mapAnswers(raw = {}, documentMeta = []) {
  const a = { ...raw };
  const set = (key, value) => {
    if (value === null || value === undefined || value === "") return;
    if (a[key] === undefined || a[key] === null || a[key] === "") a[key] = value;
  };

  // Identity
  set("Q3", a.q1_orgname);
  set("Q4", [a.q1_dept, a.q1_site].filter(Boolean).join(" · "));
  set("Q1", a.q1_system && a.q1_system.trim());
  set("Q6", a.q1_vendor && a.q1_vendor.trim());
  set("Q7", a.q1_version && a.q1_version.trim());

  // Use type and what follows from it
  const useType = mapUseType(a.q2_usetype);
  set("Q2", useType);
  set("Q_use_description", [a.q2_usetype, a.q2_usetype_other].filter(Boolean).join(" — "));
  set("Q24", useType ? DECISION_WINDOW[useType] : null);

  // Setting and population
  set("Q8", a.q38_setting);
  set("Q9", a.q30_age);
  if ((a.q35_payer || "").startsWith("Safety net") || a.q37_institution === "Federally Qualified Health Center") {
    set("Q_setting", "safety_net");
  }

  // Prevalence: exact number wins; otherwise the band midpoint
  set("Q17", PREVALENCE_BANDS[a.q3_prevalence]);
  set("Q_auc", a.q_auc);

  // Local validation
  if (startsYes(a.q7_cases) && a.Q15) set("Q_local_validation", "yes");
  if (a.q7_cases === "Yes — accessible and ready") set("Q35", "yes");

  // Thresholds the organization chose (q22/q23) and whether drift criteria exist
  set("Q_warn_pct", pct(a.q22_warn_threshold));
  set("Q_action_pct", pct(a.q23_action_threshold));
  if (pct(a.q22_warn_threshold) !== null && pct(a.q23_action_threshold) !== null) set("Q36", "yes");

  // Review, ownership, escalation
  set("Q37", defined(a.q19_cadence) ? a.q19_cadence : null);
  set("Q_review_cadence", defined(a.q19_cadence) ? a.q19_cadence : null);
  if ((a.q19_owner || "").startsWith("Named")) set("Q28", a.q15a_authority_role || a.q19_owner);
  if (a.q7a_edge) set("Q26", a.q7a_edge.startsWith("No") ? "no" : startsYes(a.q7a_edge) ? "yes" : null);
  if (startsYes(a.q7a_edge)) set("Q27", a.q7a_edge);
  set("Q29", a.q21_emergency ? (defined(a.q21_emergency) ? a.q21_emergency : "no") : null);
  if (startsYes(a.q16_notify)) set("Q30", a.q16_notify);
  if (defined(a.q20_govbody) && !a.q20_govbody.startsWith("No formal body") && a.q20_govbody !== "In development") set("Q32", a.q20_govbody);
  if ((a.q15a_authority || "").startsWith("Named")) set("Q33", a.q15a_authority_role || a.q15a_authority);
  if ((a.q15a_authority || "").startsWith("Named") && defined(a.q15_gap_time)) {
    set("Q34", `Suspension by ${a.q15a_authority_role || "named authority"}; contingency within: ${a.q15_gap_time}`);
  }
  if (startsYes(a.q13_switchover) || startsYes(a.q11_backup)) set("Q_failover", a.q13_switchover || a.q11_backup);
  if (startsYes(a.q20_authority)) set("Q_governance_body_active", "yes");
  if (startsYes(a.q27_peer_discussed)) set("Q_shared_learning", "yes");
  if (["Quarterly", "Twice yearly", "Annually"].includes(a.q28_cadence)) set("Q_external_benchmarking", "yes");

  // Joint Commission + CHAI elements (as of Oct 29, 2026)
  if (a.q41_policy) set("Q38", startsYes(a.q41_policy) ? "yes" : "no");
  if (a.q42_training) set("Q39", startsYes(a.q42_training) || a.q42_training.startsWith("Scheduled") ? "yes" : "no");
  if (a.q44_consent) set("Q40", a.q44_consent === "Yes" || a.q44_consent.startsWith("Not required") ? "yes" : "no");

  // Bias engine: how demographics are recorded locally
  const lr = localRecording(a);
  if (lr.recorded.length) set("Q_local_recording", lr.recorded);
  if (lr.inconsistent.length) set("Q_recording_inconsistencies", lr.inconsistent);

  // Documents uploaded alongside the questionnaire
  if (documentMeta.some((d) => d && d.type === "model_card")) set("Q_modelcard", "yes");

  return a;
}

module.exports = { mapAnswers };
