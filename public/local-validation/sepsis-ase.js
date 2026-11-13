// Rule pack: sepsis, after the CDC Adult Sepsis Event (ASE) surveillance definition.
// Drafted Nov 13, 2026 from published descriptions of the definition (Rhee et al., BMJ
// Qual Saf 2019 and JAMA 2017; CDC ASE toolkit). DRAFT: a clinician has to review and
// sign off on this pack before anyone relies on its labels.
//
// One row per hospital encounter. The site's own query does the date math and hands
// over the fields below; this file only applies the rules. No dates or names needed.
(function () {
  const num = (v) => {
    if (v === undefined || v === null || String(v).trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const flag = (v) => {
    if (v === undefined || v === null || String(v).trim() === "") return null;
    const s = String(v).trim().toLowerCase();
    return s === "1" || s === "y" || s === "yes" || s === "true";
  };

  // How close to a cutoff counts as "too close to call" and goes to a person.
  const NEAR = 0.1; // within 10% of a numeric threshold

  const near = (value, cutoff) => value !== null && Math.abs(value - cutoff) <= cutoff * NEAR;

  function label(row) {
    const why = [];
    const unsure = [];

    // 1. Presumed serious infection: blood culture + >=4 qualifying antimicrobial days
    // starting within +/-2 days of the culture (fewer allowed if death, hospice,
    // transfer or comfort care came first).
    const bc = flag(row.blood_culture);
    const qad = num(row.qad_count);
    const shortOk = flag(row.short_course_ok);
    if (bc === null) unsure.push("Blood culture field is blank");
    if (bc === false) return { label: "no", why: ["No blood culture drawn"], unsure: [] };
    if (qad === null) unsure.push("Qualifying antimicrobial days are blank");
    let infection = null;
    if (bc && qad !== null) {
      if (qad >= 4) { infection = true; why.push(`${qad} qualifying antimicrobial days`); }
      else if (qad >= 1 && shortOk) { infection = true; why.push(`${qad} antimicrobial days, shortened by death, hospice, transfer or comfort care`); }
      else if (qad === 0) { infection = false; }
      else if (qad >= 1 && shortOk === null) { unsure.push(`${qad} antimicrobial days, and whether the course was cut short is blank`); }
      else { infection = false; }
    }
    if (infection === false) return { label: "no", why: [qad === 0 ? "Blood culture but no qualifying antimicrobial days" : `Only ${qad} antimicrobial days`], unsure: [] };

    // 2. Acute organ dysfunction within +/-2 days of the blood culture day.
    const hits = [];
    const close = [];
    let missing = 0;
    const vaso = flag(row.vasopressor_start);
    const vent = flag(row.mech_vent_start);
    if (vaso) hits.push("vasopressor started");
    if (vent) hits.push("mechanical ventilation started");
    if (vaso === null) missing++;
    if (vent === null) missing++;

    const lac = num(row.lactate_max);
    if (lac === null) missing++;
    else if (lac >= 2.0) { hits.push(`lactate ${lac}`); if (near(lac, 2.0)) close.push(`lactate ${lac} is just over 2.0`); }
    else if (near(lac, 2.0)) close.push(`lactate ${lac} is just under 2.0`);

    const esrd = flag(row.esrd);
    const cr = num(row.creatinine_ratio);
    if (cr === null) missing++;
    else if (cr >= 2.0) {
      if (esrd) { /* excluded */ }
      else if (esrd === null) close.push(`creatinine doubled (x${cr}) but end-stage renal disease is blank`);
      else hits.push(`creatinine x${cr} from baseline`);
    } else if (near(cr, 2.0) && !esrd) close.push(`creatinine x${cr} is just under doubling`);

    const bili = num(row.bilirubin_max), biliR = num(row.bilirubin_ratio);
    if (bili === null || biliR === null) missing++;
    else if (bili >= 2.0 && biliR >= 2.0) hits.push(`bilirubin ${bili}, x${biliR} from baseline`);
    else if ((bili >= 2.0 && near(biliR, 2.0)) || (biliR >= 2.0 && near(bili, 2.0))) close.push(`bilirubin ${bili} (x${biliR}) is close to the cutoff`);

    const plt = num(row.platelet_min), pltB = num(row.platelet_baseline);
    if (plt === null || pltB === null) missing++;
    else if (pltB >= 100) {
      const drop = plt / pltB;
      if (plt < 100 && drop <= 0.5) hits.push(`platelets ${plt} from ${pltB}`);
      else if ((plt < 100 && near(drop, 0.5)) || (drop <= 0.5 && near(plt, 100))) close.push(`platelets ${plt} from ${pltB} is close to the cutoff`);
    }

    if (unsure.length) return { label: "unsure", why, unsure };
    if (hits.length) {
      // A single hit that sits right at its cutoff goes to a person.
      if (hits.length === 1 && close.length && close[0].includes("just over")) {
        return { label: "unsure", why: [...why, ...hits], unsure: close };
      }
      return { label: "yes", why: [...why, ...hits], unsure: [] };
    }
    if (close.length) return { label: "unsure", why, unsure: close };
    if (missing >= 4) return { label: "unsure", why, unsure: [`${missing} of the organ dysfunction fields are blank`] };
    return { label: "no", why: [...why, "No organ dysfunction criterion met"], unsure: [] };
  }

  window.RULE_PACKS = window.RULE_PACKS || {};
  window.RULE_PACKS.sepsis_ase = {
    id: "sepsis_ase",
    name: "Sepsis (CDC Adult Sepsis Event)",
    version: "2026-11-13 draft",
    status: "Draft. Needs clinician review and sign-off before its labels are relied on.",
    source: "CDC Adult Sepsis Event surveillance definition: presumed serious infection (blood culture plus 4 or more qualifying antimicrobial days starting within 2 days of it) plus acute organ dysfunction within 2 days of the blood culture.",
    caveat: "The ASE is a surveillance definition built for looking back, not a bedside diagnosis. It needs 4 antibiotic days on purpose, to drop patients whose empiric antibiotics were stopped. Some patients your clinicians would call sepsis will not meet it, and the reverse.",
    columns: [
      ["encounter_id", "Your own study ID for the encounter. Not an MRN.", true],
      ["model_score", "The model's highest score during the encounter (or use model_alert).", false],
      ["model_alert", "1 if the model alerted during the encounter, 0 if not.", false],
      ["blood_culture", "1 if a blood culture was drawn, 0 if not.", true],
      ["qad_count", "Consecutive qualifying antimicrobial days starting within 2 days of the blood culture day.", true],
      ["short_course_ok", "1 if death, hospice, transfer or comfort care came before 4 antimicrobial days were possible.", false],
      ["vasopressor_start", "1 if a vasopressor was started within 2 days of the blood culture day.", false],
      ["mech_vent_start", "1 if mechanical ventilation was started within 2 days of the blood culture day.", false],
      ["lactate_max", "Highest lactate (mmol/L) within 2 days of the blood culture day.", false],
      ["creatinine_ratio", "Highest creatinine in the window divided by baseline.", false],
      ["esrd", "1 if the patient has end-stage renal disease.", false],
      ["bilirubin_max", "Highest total bilirubin (mg/dL) in the window.", false],
      ["bilirubin_ratio", "Highest bilirubin divided by baseline.", false],
      ["platelet_min", "Lowest platelet count (x10^3/uL) in the window.", false],
      ["platelet_baseline", "Baseline platelet count (x10^3/uL).", false],
      ["age_group", "For per-group numbers, e.g. 18-44, 45-64, 65+.", false],
      ["sex", "For per-group numbers.", false],
      ["race_ethnicity", "For per-group numbers.", false],
      ["language", "For per-group numbers.", false],
      ["payer", "For per-group numbers.", false],
    ],
    label,
  };
})();
