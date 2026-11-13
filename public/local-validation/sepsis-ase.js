// Rule pack: sepsis, after the CDC Adult Sepsis Event (ASE) surveillance definition.
// Pure data; the engine (engine.js) runs it. Drafted Nov 13, 2026 from published
// descriptions of the definition (Rhee et al., JAMA 2017 and BMJ Qual Saf 2019; CDC ASE
// toolkit). DRAFT until a clinician signs it off (fill in "signoff").
(function (root) {
  const pack = {
    id: "sepsis_ase",
    name: "Sepsis (CDC Adult Sepsis Event)",
    version: "2026-11-13",
    labels: { yes: "Sepsis", no: "Not sepsis" },
    signoff: null, // { name, role, date } once a clinician has reviewed every rule below
    source: "CDC Adult Sepsis Event surveillance definition: presumed serious infection (blood culture plus 4 or more qualifying antimicrobial days starting within 2 days of it) plus acute organ dysfunction within 2 days of the blood culture.",
    caveat: "A surveillance definition built for looking back, not a bedside diagnosis. It needs 4 antibiotic days on purpose, to drop patients whose empiric antibiotics were stopped. Some patients your clinicians would call sepsis won't meet it, and the reverse.",
    columns: [
      { name: "encounter_id", desc: "Your own study ID for the encounter. Not an MRN.", required: true },
      { name: "model_score", desc: "The model's highest score during the encounter (or use model_alert)." },
      { name: "model_alert", desc: "1 if the model alerted during the encounter, 0 if not." },
      { name: "blood_culture", desc: "1 if a blood culture was drawn, 0 if not.", required: true, show: true },
      { name: "qad_count", desc: "Consecutive qualifying antimicrobial days starting within 2 days of the blood culture day.", required: true, show: true },
      { name: "short_course_ok", desc: "1 if death, hospice, transfer or comfort care came before 4 antimicrobial days were possible.", show: true },
      { name: "vasopressor_start", desc: "1 if a vasopressor was started within 2 days of the blood culture day.", show: true },
      { name: "mech_vent_start", desc: "1 if mechanical ventilation was started within 2 days of the blood culture day.", show: true },
      { name: "lactate_max", desc: "Highest lactate (mmol/L) within 2 days of the blood culture day.", show: true },
      { name: "creatinine_ratio", desc: "Highest creatinine in the window divided by baseline.", show: true },
      { name: "esrd", desc: "1 if the patient has end-stage renal disease.", show: true },
      { name: "bilirubin_max", desc: "Highest total bilirubin (mg/dL) in the window.", show: true },
      { name: "bilirubin_ratio", desc: "Highest bilirubin divided by baseline.", show: true },
      { name: "platelet_min", desc: "Lowest platelet count (x10^3/uL) in the window.", show: true },
      { name: "platelet_baseline", desc: "Baseline platelet count (x10^3/uL).", show: true },
      { name: "age_group", desc: "For per-group numbers, e.g. 18-44, 45-64, 65+.", group: true },
      { name: "sex", desc: "For per-group numbers.", group: true },
      { name: "race_ethnicity", desc: "For per-group numbers.", group: true },
      { name: "language", desc: "For per-group numbers.", group: true },
      { name: "payer", desc: "For per-group numbers.", group: true },
    ],
    // Every gate condition must hold, or the answer is "no".
    gate: [
      { col: "blood_culture", is: true, label: "blood culture drawn", failText: "No blood culture drawn" },
      { label: "presumed serious infection", failText: "Fewer than 4 qualifying antimicrobial days",
        any: [
          { col: "qad_count", op: ">=", value: 4 },
          { all: [ { col: "qad_count", op: ">=", value: 1 }, { col: "short_course_ok", is: true } ] },
        ] },
    ],
    // Any one criterion is enough for "yes" (acute organ dysfunction).
    criteria: [
      { col: "vasopressor_start", is: true, label: "vasopressor started" },
      { col: "mech_vent_start", is: true, label: "mechanical ventilation started" },
      { col: "lactate_max", op: ">=", value: 2.0, near: 0.1 },
      { col: "creatinine_ratio", op: ">=", value: 2.0, near: 0.1, unless: { col: "esrd", is: true } },
      { label: "bilirubin at least 2.0 and doubled", all: [
        { col: "bilirubin_max", op: ">=", value: 2.0, near: 0.1 },
        { col: "bilirubin_ratio", op: ">=", value: 2.0, near: 0.1 } ] },
      { label: "platelets under 100 and halved from a baseline of at least 100", all: [
        { col: "platelet_baseline", op: ">=", value: 100 },
        { col: "platelet_min", op: "<", value: 100, near: 0.1 },
        { ratio: ["platelet_min", "platelet_baseline"], op: "<=", value: 0.5, near: 0.1 } ] },
    ],
    maxBlankCriteria: 3, // 4 or more blank organ-dysfunction criteria with no hit: a person decides
    noCriteriaText: "No organ dysfunction criterion met",
  };
  if (typeof module !== "undefined" && module.exports) module.exports = pack;
  else { root.RULE_PACKS = root.RULE_PACKS || {}; root.RULE_PACKS[pack.id] = pack; }
})(typeof window !== "undefined" ? window : globalThis);
