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
  // Added Nov 14, 2026 so the ROI Assessment and this list match. The engine already had these profiles.
  ["Diagnostic support", "diagnostic_primary"],
  ["Administrative / operational", "operational_efficiency"],
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

  // Local validation counts (added Nov 12, 2026). Counts carry the sample size, so the
  // engines can print confidence intervals; percentages alone cannot.
  const n4 = ["q_tp", "q_fn", "q_tn", "q_fp"].map((k) => {
    const v = parseFloat(a[k]);
    return Number.isFinite(v) && v >= 0 ? Math.round(v) : null;
  });
  if (n4.every((v) => v !== null)) {
    const [tp, fn, tn, fp] = n4;
    set("Q_tp", tp); set("Q_fn", fn); set("Q_tn", tn); set("Q_fp", fp);
    if (tp + fn > 0) set("Q15", Math.round((tp / (tp + fn)) * 1000) / 10);
    if (tn + fp > 0) set("Q16", Math.round((tn / (tn + fp)) * 1000) / 10);
    set("Q_cohort_size", `${tp + fn + tn + fp} cases (${tp + fn} positive, ${tn + fp} negative)`);
  }
  // Where the counts came from (the Local Validation Kit fills this in, Nov 13, 2026)
  if (typeof a.q_counts_source === "string" && a.q_counts_source.trim()) set("Q_cohort_description", a.q_counts_source.trim());
  set("Q_floor_sens", a.q_floor_sens);
  set("Q_floor_spec", a.q_floor_spec);
  set("Q_false_alarms", a.q_false_alarms);

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

  // Second content pass (Nov 13, 2026): questions for slots the report already had
  if (defined(a.q_autonomy)) set("Q_autonomy", a.q_autonomy);
  if (defined(a.q_fda)) set("Q_fda", a.q_fda);
  if (typeof a.q_limits === "string" && a.q_limits.trim()) set("Q_contraindications", a.q_limits.trim());
  // Vendor-disclosed training demographics -> bias engine axis ids. "Not asked yet" or no
  // answer leaves it unset, so the engine says it hasn't been recorded.
  const VENDOR_AXES = {
    "Race / ethnicity": "race_ethnicity", "Sex / gender": "sex_gender", "Age": "age",
    "Socioeconomic status / insurance": "socioeconomic", "Language": "language",
    "Geographic region": "geography", "Comorbidities": "comorbidity", "Disability status": "disability",
    "BMI / body habitus": "bmi", "Social determinants of health": "social_determinants",
  };
  const vd = Array.isArray(a.q_vendor_demo) ? a.q_vendor_demo : [];
  const vdAxes = vd.map((x) => VENDOR_AXES[x]).filter(Boolean);
  if (vdAxes.length) set("Q_vendor_demographics", vdAxes);
  else if (vd.some((x) => x.startsWith("None"))) set("Q_vendor_demographics", "not_disclosed");

  // Documents uploaded alongside the questionnaire
  if (documentMeta.some((d) => d && d.type === "model_card")) set("Q_modelcard", "yes");
  if (a.q1_modelcard) {
    set("Q_modelcard", /^(Yes|Built in-house)/.test(a.q1_modelcard) ? "yes" : /^(No|Partial)/.test(a.q1_modelcard) ? "no" : null);
    set("Q_modelcard_detail", a.q1_modelcard);
  }

  return a;
}

module.exports = { mapAnswers };
