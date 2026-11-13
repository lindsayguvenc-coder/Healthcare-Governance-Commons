// api/generate-protocol.js
// Item 14 — Validation Protocol PDF Orchestrator
// Calls vpg-engines (consolidated) in parallel for each engine.
// Assembles the full 7-section protocol object and returns it for client-side PDF rendering.
// The client (jsPDF) handles actual PDF generation — this route produces the structured data.
//
// Input:  { answers, logicFlags, gapFlags, documents (metadata only, no PHI) }
// Output: { protocol: { sections: [...], meta, gapFlags, logicFlags } }

const { mapAnswers } = require("./_answer-map.js");
const { isPaused } = require("./_pause.js");
// The site's regulatory map (also behind each node page). The VPG reads its references
// from here, so the two can't drift apart (wired in Nov 13, 2026).
const REG = require("../src/data/regulatory.json");

// Governance-area grading (old Section 5 and the cover rating) is off while it is rebuilt
// against the current Commons map (src/data/nodes.json). It graded 10 areas from the spring
// map, three of whose names now mean something else on the site, with made-up cutoffs.
// Oct 29, 2026. Set to false only once the grading reads from nodes.json.
const NODE_GRADING_PAUSED = true;
const COMMONS_MAP_URL = "https://healthcare-governance-commons.vercel.app";

// Date the regulatory and standards references in this file were last checked.
// Each group of references carries the date it was last checked. Bump a date only
// when those sources were actually re-checked.
const REFERENCES_AS_OF = "October 29, 2026";        // Joint Commission + CHAI elements
const MODELCARD_CONSENT_AS_OF = "November 12, 2026"; // ONC HTI-5 model cards; scribe recording-consent suits
const SECOND_PASS_AS_OF = "November 13, 2026";       // Section 1557 §92.210, California AB 3030, FDA CDS guidance (Jan 2026)
const CHECK_SOURCE = `Current as of ${REFERENCES_AS_OF}. Rules and standards change; check the current source before relying on this.`;

// Joint Commission + CHAI Responsible Use of AI in Healthcare: seven elements (guidance
// Sept 17, 2025; voluntary certification launched June 1, 2026).
function buildTjcElements(answers) {
  const a = answers;
  const has = (v) => typeof v === "string" && v.trim() !== "";
  const gov = has(a.q20_govbody) && !a.q20_govbody.startsWith("No formal body") && a.q20_govbody !== "In development";
  const disc = a.q43_disclosure || "";
  const rep = a.q45_safety_reporting || "";
  const st = (ok, partial) => ok ? "complete" : partial ? "recommended" : "incomplete";
  return [
    { item: "Policies and governance structure: a body that reviews AI", status: st(gov) },
    { item: "Patient privacy and transparency: patients told when AI is used", status: st(disc.startsWith("Yes"), disc === "Case by case") },
    { item: "Data security and data use: review completed", status: st((a.q46_security || "").startsWith("Yes"), a.q46_security === "In progress") },
    { item: "Ongoing quality monitoring: named owner and a review cadence", status: st(!!a.Q28 && !!a.Q37) },
    { item: "Safety event reporting: a defined path for AI events", status: st(rep.startsWith("Our safety event system, with") || rep.startsWith("A separate"), rep.startsWith("Our safety event system, no")) },
    { item: "Risk and bias assessment: Section 3 reviewed by clinical governance", status: "recommended" },
    { item: "Education and training: staff trained before go-live", status: st(a.Q39 === "yes") },
  ];
}

// Fields the report has a slot for but the questionnaire never asks. Before Oct 29 these
// printed as findings ("Not disclosed", "No", a red X), which read as facts about the
// organization when nobody had been asked. Now they say so plainly.
const NOT_ASKED_TEXT = "Not asked by this tool. Fill in by hand.";
const NOT_ASKED = new Set([
  "Q5", "Q10", "Q11", "Q12",
  "Q_volume", "Q_cohort_description",
  "Q_perf_summary", "Q_workflow_note",
  "Q_preparer", "Q_reviewer", "Q_approver", "Q_next_review",
  "Q_revalidation_trigger",
]);
// value if answered; the not-asked note if the questionnaire has no question for it;
// otherwise the fallback (the question exists and was left blank)
function field(answers, key, fallback) {
  const v = answers[key];
  if (v !== undefined && v !== null && v !== "") return v;
  return NOT_ASKED.has(key) ? NOT_ASKED_TEXT : fallback;
}
// checklist status: complete / incomplete, or not-asked when there is no question for it
function check(answers, key, isComplete) {
  if (isComplete) return "complete";
  const v = answers[key];
  return NOT_ASKED.has(key) && (v === undefined || v === null || v === "") ? "not-asked" : "incomplete";
}

// ─── Second content pass (Nov 13, 2026) ─────────────────────────────────────

function autonomyFlags(raw) {
  const v = raw.q_autonomy || "";
  const flags = [];
  if (v.startsWith("Acts unless") || v.startsWith("Acts on its own")) flags.push("HIGH_AUTONOMY");
  if (v.startsWith("Recommends a specific")) flags.push("DIRECT_CLINICAL_DECISION");
  return flags;
}

const yes = (v) => typeof v === "string" && v.startsWith("Yes");
const unknownish = (v) => !v || v === "Unknown" || v === "Unsure";

function secondPassGapFlags(a) {
  const f = [];
  if (unknownish(a.q_autonomy)) f.push("Autonomy level not set. Say how much stands between its output and the patient; high-autonomy systems get tighter thresholds and an independent sign-off on changes.");
  const fda = a.q_fda || "";
  if (unknownish(fda)) f.push("FDA status unknown. Ask the vendor for the clearance number (510(k), De Novo or PMA) or its basis for calling it non-device. It decides which FDA duties apply, including reporting device-related deaths and serious injuries (21 CFR 803).");
  if (fda.startsWith("Built in-house")) f.push("Built in-house and not reviewed against FDA criteria. Check whether it meets the non-device clinical decision support criteria (FDA guidance revised Jan 6, 2026) or is a device.");
  if (fda.startsWith("Cleared, with a predetermined")) f.push("The FDA-cleared change control plan (PCCP) lets the vendor update the model within that plan without a new FDA review. Get the plan, and make sure the contract gives you notice and time to re-check each update.");
  const inp = a.q_inputs_protected || "";
  if (inp.startsWith("Yes")) f.push("It uses race, color, national origin, sex, age or disability as an input. Under Section 1557 (45 CFR 92.210), covered entities must make reasonable efforts to identify this and reduce the risk of discrimination. Document both.");
  if (unknownish(inp)) f.push("Not known whether it uses race, color, national origin, sex, age or disability as an input. Section 1557 (45 CFR 92.210) expects covered entities to find out. Ask the vendor for its input variables.");
  const msg = a.q_patient_msgs || "";
  if (msg.startsWith("Yes — some go out")) f.push("Some AI-written clinical messages reach patients without clinician review. In California (AB 3030) each one needs a disclaimer that AI wrote it and instructions for reaching a person. Check your state's rules.");
  const vd = Array.isArray(a.q_vendor_demo) ? a.q_vendor_demo : [];
  if (vd.some((x) => x.startsWith("None"))) f.push("The vendor did not disclose who was in its training data. Make disclosure a contract condition; until then, local subgroup numbers are the only check.");
  const out = a.q_outcomes || "";
  if (out.startsWith("No") || unknownish(out)) f.push("No plan to measure whether the outcome it targets changed. Accuracy alone can't show it helps patients. Pick one outcome measure and a data source.");
  if (out.startsWith("Planned, no data source")) f.push("An outcome measure is planned but has no data source yet.");
  const cd = a.q_contract_data || "";
  if (!cd.startsWith("Yes")) f.push("The contract doesn't secure the performance data you need to monitor it yourself. Without it, monitoring depends on the vendor's reports.");
  const cu = a.q_contract_updates || "";
  if (!cu.startsWith("Yes — with time")) f.push(cu.startsWith("Yes — notice only") ? "The vendor gives notice of model updates but no time to test them before go-live." : "No contract duty to tell you before a model update goes live. An unannounced update can change performance overnight.");
  const cdu = a.q_contract_datause || "";
  if (!cdu.startsWith("Yes")) f.push("The contract doesn't limit what the vendor may do with your data or how long it keeps it.");
  const ce = a.q_contract_exit || "";
  if (ce === "No" || ce === "Only at renewal") f.push("You can't suspend it for safety or performance reasons without a penalty" + (ce === "Only at renewal" ? " until renewal" : "") + ". A stop decision should not cost money.");
  const dc = a.q_decommission || "";
  if (!dc.startsWith("Yes")) f.push("No written plan for retiring it for good: criteria, who decides, what replaces it, and what happens to its data.");
  return f;
}

// References drawn from src/data/regulatory.json, chosen by the answers. Verified
// entries only.
function regulatoryReferences(a) {
  const fda = a.q_fda || "";
  const device = /^(FDA-cleared|Cleared)/.test(fda);
  const pccp = fda.startsWith("Cleared, with a predetermined");
  const nonDevice = fda.startsWith("Vendor says") || fda.startsWith("Built in-house");
  const fdaUnknown = unknownish(fda);
  const msgs = a.q_patient_msgs || "";
  const nodes = REG.nodes || {};
  const pick = (node, tier, re) => ((nodes[node] || {})[tier] || []).filter((i) => i.verified && re.test(i.text));
  const refs = [
    ...pick("equity", "required", /1557/),
    ...(device || fdaUnknown ? [...pick("validation", "required", /premarket/), ...pick("watcher", "required", /803/)] : []),
    ...(pccp ? pick("h2", "required", /change control/i) : []),
    ...(nonDevice || fdaUnknown ? pick("explainability", "required", /CDS/) : []),
    ...(msgs.startsWith("Yes") || unknownish(msgs) ? pick("explainability", "required", /3030/) : []),
    ...pick("validation", "recommended", /Joint Commission/),
  ];
  const seen = new Set();
  return refs.filter((r) => !seen.has(r.text) && seen.add(r.text))
    .map((r) => `${r.text}. Applies to: ${r.binds}.`);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (isPaused("vpg")) {
    return res.status(503).json({ error: "Report generation is paused while this tool is reviewed." });
  }

  try {
    const { logicFlags: logicFlagsIn = [], gapFlags: gapFlagsIn = [], documentMeta = [] } = req.body;
    const rawAnswers = req.body.answers || {};

    if (!rawAnswers || Object.keys(rawAnswers).length === 0) {
      return res.status(400).json({ error: "No answers provided. Complete elicitation before generating protocol." });
    }

    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

    // Translate questionnaire ids (q2_usetype, q19_owner, ...) into engine keys (Q2, Q28, ...)
    const answers = mapAnswers(rawAnswers, documentMeta);
    // The engines tighten tiers on HIGH_AUTONOMY / DIRECT_CLINICAL_DECISION, but until
    // Nov 13, 2026 no question set either flag. Now the autonomy answer does.
    const logicFlags = [...logicFlagsIn, ...autonomyFlags(rawAnswers)];
    const gapFlags = [...gapFlagsIn, ...secondPassGapFlags(rawAnswers)];

    // Call all three engines in parallel
    const [tiersResult, biasResult, nodesResult] = await Promise.all([
      callEngine(`${baseUrl}/api/vpg-engines`, { engine: 'westgard', answers, logicFlags, gapFlags }),
      callEngine(`${baseUrl}/api/vpg-engines`, { engine: 'bias', answers, logicFlags, gapFlags }),
      NODE_GRADING_PAUSED
        ? Promise.resolve({ paused: true })
        : callEngine(`${baseUrl}/api/vpg-engines`, { engine: 'nodes', answers, logicFlags, gapFlags }),
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
  const deploymentName = answers.Q1 || "AI system (name not given)";
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
  const overallNodeRating = nodesResult.paused ? null
    : (nodesResult.overallRating || { rating: "unknown", label: "Assessment incomplete", summary: "" });
  const biasSummaryRating = biasResult.compatibilityTable?.summary?.overallRating || (biasResult.mode === "qualitative" ? "qualitative" : "unknown");

  const sections = [
      buildSection1(answers, documentMeta, isFullProtocol),
      buildSection2(answers, isFullProtocol, tiersResult.metrics, tiersResult.trackResult),
      buildSection3(biasResult, isFullProtocol, answers),
      buildSection4(tiersResult, isFullProtocol),
      buildSection5(nodesResult, isFullProtocol),
      buildSection6(answers, tiersResult, nodesResult, isFullProtocol),
      buildSection7(answers, allGapFlags, overallNodeRating, isFullProtocol),
  ];

  return {
    summary: buildSummary(answers, sections, tiersResult, biasResult, allGapFlags),
    meta: {
      title: `Validation Protocol: ${deploymentName}`,
      deploymentName,
      institution,
      useType,
      useTypeLabel: answers.q2_usetype ? answers.q2_usetype.split(" — ")[0] : useType,
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
    sections,
  };
}

// One-page summary up front (Nov 13, 2026): the verdict, the key facts, what must close
// before go-live, and the first open items. Everything here is repeated from the
// sections; nothing new is computed.
function buildSummary(answers, sections, tiersResult, biasResult, allGapFlags) {
  const s6 = sections.find((s) => s.sectionNumber === 6) || {};
  const m = tiersResult.metrics || {};
  const tp = tiersResult.tierProfile || {};
  const counts = biasResult.compatibilityTable?.summary?.counts || biasResult.compatibilityTable?.summary || null;
  const cond = ((s6.subsections || []).find((x) => x.title === "Deployment Conditions") || {}).content?.conditions || [];
  const short = (v) => (typeof v === "string" ? v.split(" — ")[0] : v);
  const facts = [
    ["System", answers.Q1 || "Not named"],
    ["Use", short(answers.q2_usetype) || "Not answered"],
    ["Autonomy", short(answers.q_autonomy) || "Not answered"],
    ["FDA status", short(answers.q_fda) || "Not answered"],
    ["Risk class", tp.riskClass ? `${tp.riskClass} (sets how tight the monitoring is)` : "Not set"],
  ];
  if (tiersResult.trackResult) facts.push(["Validation track", tiersResult.trackResult.track === "scribe" ? "Ambient scribe: note errors, omissions, review" : "Agent: end state, tool calls, policy"]);
  else {
    facts.push(["Local sensitivity", m.sensDisplay || "Not provided"]);
    facts.push(["Local specificity", m.specDisplay || "Not provided"]);
  }
  if (counts) facts.push(["Bias table", `${counts.compatible || 0} compatible, ${counts.partial || 0} partial, ${counts.incompatible || 0} incompatible, ${counts.unknown || 0} unknown`]);
  facts.push(["Who can stop it", answers.Q33 || "Not named"]);
  facts.push(["Monitoring owner", answers.Q28 || "Not named"]);
  return {
    verdict: s6.overallRating || null,
    facts,
    required: cond.filter((c) => c.startsWith("REQUIRED")).map((c) => c.replace(/^REQUIRED( BEFORE GO-LIVE)?:\s*/, "")),
    topItems: allGapFlags.slice(0, 6).map((f) => String(f).replace(/^[A-Z_]+:\s*/, "")),
    totalOpen: allGapFlags.length,
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
          deploymentName: field(answers, "Q1", "Not specified"),
          useType: answers.q2_usetype || answers.Q2 || "Not specified",
          institution: answers.Q3 || "Not specified",
          department: answers.Q4 || "Not specified",
          deploymentDate: field(answers, "Q5", "Not specified"),
          vendor: field(answers, "Q6", "Not specified"),
          modelVersion: field(answers, "Q7", "Not specified"),
        },
      },
      {
        title: "Clinical Context",
        content: {
          clinicalSetting: answers.Q8 || "Not specified",
          targetPopulation: answers.Q9 || "Not specified",
          intendedUseDescription: answers.Q_use_description || answers.Q_S1_describe || "Not provided",
          autonomyLevel: field(answers, "Q_autonomy", "Not answered"),
          protectedInputs: answers.q_inputs_protected || "Not answered",
          aiMessagesToPatients: answers.q_patient_msgs || "Not answered",
          decisionWindow: answers.Q24 || "Not specified",
          patientVolumeAffected: field(answers, "Q_volume", "Not specified"),
        },
      },
      {
        title: "Documents Reviewed",
        content: {
          documentCount: documentMeta.length || "None. Document upload is paused; this protocol is built from answers only.",
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
function buildSection2(answers, isFullProtocol, m = null, tr = null) {
  const hasMetrics = answers.Q15 || answers.Q16;
  return {
    sectionNumber: 2,
    title: isFullProtocol ? "Model Characterization & Performance Baseline" : "Model Characterization",
    subsections: [
      {
        title: "Vendor-Reported Characteristics",
        content: {
          modelArchitecture: field(answers, "Q10", "Not disclosed"),
          trainingDataDescription: field(answers, "Q11", "Not disclosed"),
          vendorValidationSummary: field(answers, "Q12", "Not disclosed"),
          modelCardAvailable: answers.Q_modelcard_detail || (answers.Q19 === "yes" || answers.Q_modelcard === "yes" ? "Yes" : "Not answered"),
          fdaStatus: field(answers, "Q_fda", "Not answered"),
          vendorDisclosedPatientGroups: Array.isArray(answers.q_vendor_demo) && answers.q_vendor_demo.length ? answers.q_vendor_demo.join(", ") : "Not answered",
        },
      },
      isFullProtocol && tr
        ? {
            title: "Local Validation Baseline",
            content: Object.assign(
              { validationTrack: tr.track === "scribe" ? "Ambient scribe / note drafting: judged on transcription, note errors and omissions, review and consent. Sensitivity and specificity do not apply." : "Agentic workflow: judged on end state, tool calls and policy adherence. Sensitivity and specificity do not apply." },
              Object.fromEntries(tr.rows.slice(0, 3).map(([k, v]) => [k.replace(/[^A-Za-z ]/g, "").replace(/ (\w)/g, (_, c) => c.toUpperCase()).replace(/^./, (c) => c.toLowerCase()), v]))
            ),
          }
        : isFullProtocol
        ? {
            title: "Local Validation Baseline",
            content: {
              localValidationPerformed: answers.Q_local_validation === "yes" ? "Yes" : "Not yet performed — see gap flags",
              sensitivity: m?.sensDisplay || "Not provided",
              specificity: m?.specDisplay || "Not provided",
              prevalence: m?.prevalenceDisplay || "Not provided",
              aurocNote: m?.aucDisplay || "Not provided",
              calibration: m?.calibrationDisplay || "Not answered",
              performanceByGroup: m?.subgroupDisplay || "Not answered",
              validationCohortSize: field(answers, "Q_cohort_size", "Not provided (enter the four counts to get this and the confidence intervals)"),
              validationCohortDescription: field(answers, "Q_cohort_description", "Not provided"),
              metricsNote: !hasMetrics
                ? "No performance metrics provided. Monitoring thresholds in Section 4 are based on use-type defaults. Provide local validation metrics to generate deployment-specific thresholds."
                : null,
            },
          }
        : {
            title: "Performance Summary",
            content: {
              performanceSummary: field(answers, "Q_perf_summary", "Not provided"),
              workflowIntegrationNote: field(answers, "Q_workflow_note", "Not provided"),
            },
          },
      {
        title: "Known Limitations",
        content: {
          knownLimitsAndContraindications: field(answers, "Q_contraindications", "None entered. Ask the vendor for known limits, and add what your own testing found."),
        },
      },
    ],
  };
}

// Section 3: Bias & Fairness Assessment (from bias-crossref engine)
function buildSection3(biasResult, isFullProtocol, answers = {}) {
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
              modelCardAvailable: answers.Q_modelcard_detail || (biasResult.modelCardAvailable ? "Yes" : "Not answered"),
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
        title: tiersResult.trackResult ? (tiersResult.track === "scribe" ? "Performance Baseline — Ambient Scribe Track" : "Performance Baseline — Agentic Workflow Track") : "Performance Metrics Baseline",
        content: tiersResult.trackResult ? {
          trackRows: tiersResult.trackResult.rows,
          metricsNote: "Intervals are 95% Wilson intervals from the counts entered. Sensitivity, specificity and prevalence do not apply to this use type. Measures follow the Commons Agent QC picker and the Duke ambient-scribe evaluation framework (npj Digital Medicine, 2025).",
        } : {
          metrics: tiersResult.metrics,
          metricsNote: !tiersResult.metrics?.calculable
            ? "PPV and NPV could not be calculated. Local prevalence was not provided or performance metrics were not provided. Thresholds below are use-type defaults."
            : "Intervals are 95% Wilson intervals from the counts entered. PPV, NPV, alert rate and net benefit are computed at the prevalence shown; recompute if it changes. AUROC, if shown, averages over every threshold, including ones you will never use; judge the model by the numbers at your threshold. Measures follow the Commons Agent QC picker (Nov 2026).",
        },
      },
      {
        title: "Tier Profile",
        content: {
          riskClass: tiersResult.tierProfile?.riskClass,
          tierSensitivity: tiersResult.tierProfile?.tierSensitivity,
          thresholds: tiersResult.tierProfile?.thresholds,
          rationale: [
            tiersResult.tierProfile?.falseNegBias && !tiersResult.track
              ? (tiersResult.tierProfile?.thresholds?.sensitivityFloor
                ? "Missed cases are the higher-harm error for this use type, so the sensitivity floor is a hard stop."
                : "Missed cases are the higher-harm error for this use type. Set a sensitivity floor; once set, it is a hard stop.")
              : null,
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
      { title: "Control Material", content: { rationale: tiersResult.controlMaterial?.rationale || [] } },
      { title: "Monitoring Rule Set Performance", content: { rationale: tiersResult.ruleSetPerformance?.rationale || [] } },
      { title: "Prevalence & Positive-Call Rate", content: { rationale: tiersResult.prevalenceMonitoring?.rationale || [] } },
      { title: "Change Control (Risk-Based)", content: { rationale: tiersResult.changeControl?.rationale || [] } },
      { title: "Lookback Scope", content: { rationale: tiersResult.lookback?.rationale || [] } },
      { title: "Response Layer", content: { rationale: tiersResult.responseLayer?.rationale || [] } },
      { title: "AI-Specific Validation Additions", content: { rationale: tiersResult.aiValidation?.rationale || [] } },
    ],
    tierGapFlags: tiersResult.tierGapFlags || [],
  };
}

// Section 5: Governance Node Assessment (from commons-node-mapper engine)
function buildSection5(nodesResult, isFullProtocol) {
  if (nodesResult.paused) {
    return {
      sectionNumber: 5,
      title: "Governance Map",
      subsections: [
        {
          title: "Governance areas for this deployment",
          content: {
            narrativeSummary:
              "This section used to grade your answers against areas of the Commons governance map. That grading is being rebuilt " +
              "against the current map and is switched off, so this protocol gives no overall governance rating. " +
              `Use the map at ${COMMONS_MAP_URL} to walk through the areas that apply to this deployment: who watches it, ` +
              "who can stop it, how disputes and complaints are handled, equity monitoring, and vendor risk, among others.",
          },
        },
      ],
    };
  }
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

  // Readiness comes from the deployment conditions printed below, so the two can't
  // disagree (Nov 13, 2026). The old verdict counted critical governance nodes, which
  // are paused, and was never printed.
  const conditions = buildDeploymentConditions(answers, tiersResult, nodesResult, isFullProtocol);
  const required = conditions.filter((c) => c.startsWith("REQUIRED")).length;
  const overallRating = required
    ? { status: "conditional", label: `Not ready to go live: ${required} required condition${required > 1 ? "s" : ""} open`, rationale: "Close the required conditions below, then re-run this protocol." }
    : { status: "recommended", label: "Baseline go-live conditions met", rationale: "Monitoring, the open items in Section 7 and periodic review still apply." };

  return {
    sectionNumber: 6,
    title: "Implementation Readiness & Deployment Conditions",
    overallRating,
    subsections: [
      {
        title: "Pre-Deployment Checklist",
        content: {
          items: [
            { item: "Local validation performed or formally deferred with documented rationale", status: answers.Q_local_validation === "yes" ? "complete" : "incomplete" },
            { item: "Monitoring owner named and notified", status: hasMonitoringOwner ? "complete" : "incomplete" },
            { item: "Stop criteria defined and documented", status: hasStopCriteria ? "complete" : "incomplete" },
            { item: "Failover workflow documented", status: hasFailover ? "complete" : "incomplete" },
            { item: "Staff training completed or scheduled", status: check(answers, "Q39", answers.Q39 === "yes") },
            { item: "Use policy approved", status: check(answers, "Q38", answers.Q38 === "yes") },
            { item: "Patient consent process defined (if applicable)", status: check(answers, "Q40", answers.Q40 === "yes") },
            { item: "Bias assessment reviewed by clinical governance", status: (nodesResult.overallRating?.rating === "critical") ? "required" : "recommended" },
            { item: "Corrective action owner designated", status: answers.Q28 ? "complete" : "incomplete" },
            { item: "Change triggers and tiers defined", status: check(answers, "Q_revalidation_trigger", !!answers.Q_revalidation_trigger) },
          ],
          note: "* recommended, ! required. ? means this tool does not ask about it; confirm by hand.",
        },
      },
      {
        title: "Joint Commission / CHAI Elements Checklist",
        content: {
          items: buildTjcElements(answers),
          note: "The seven elements of the Joint Commission + CHAI Responsible Use of AI guidance (Sept 2025), the basis of the voluntary certification launched June 1, 2026. * means partly in place or still to review. " + CHECK_SOURCE,
        },
      },
      {
        title: "Deployment Conditions",
        content: {
          conditions,
        },
      },
      {
        title: "Contract Terms",
        content: {
          performanceDataAccess: answers.q_contract_data || "Not answered",
          noticeBeforeModelUpdates: answers.q_contract_updates || "Not answered",
          dataUseAndRetention: answers.q_contract_datause || "Not answered",
          suspendWithoutPenalty: answers.q_contract_exit || "Not answered",
          note: "These terms decide whether you can monitor it yourself and react to updates. They matter more since HTI-5 removed the federal model-card requirement for certified EHRs.",
        },
      },
      {
        title: "Outcomes and Retirement",
        content: {
          outcomeMeasure: answers.q_outcomes || "Not answered",
          retirementPlan: answers.q_decommission || "Not answered",
        },
      },
      {
        title: "Change Triggers and Tiers",
        content: {
          note: "Each trigger leads to one of three tiers (see Change Control in Section 4): re-baseline, verification or revalidation. Not every change is a revalidation.",
          triggers: [
            "Vendor model version change → verification (control set plus a real-task sample; independent authority signs)",
            "Prompt or configuration change within validated scope → verification",
            "New or replaced control item, or new control lot → re-baseline of that control (operator signs)",
            "Change to intended use, patient population, data source or retrieval corpus → revalidation (independent authority and clinical leadership sign)",
            "Monitoring rejection or sustained drift → hold and corrective action; once the cause is found, classify the change into one of the tiers above",
            "Change in clinical workflow, merger or reorganization → review, then classify into a tier",
            answers.Q_revalidation_trigger || "Additional site-specific trigger: [not defined — complete before deployment]",
          ],
        },
      },
    ],
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
        title: overallNodeRating ? "Overall Governance Assessment" : "Preparation and Sign-off",
        content: {
          ...(overallNodeRating ? { rating: overallNodeRating } : {}),
          assessmentDate: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
          protocolPreparedBy: field(answers, "Q_preparer", "Not specified"),
          reviewedBy: field(answers, "Q_reviewer", "Pending review"),
          approvedBy: field(answers, "Q_approver", "Pending approval"),
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
          note: (allGapFlags.length > 15 ? `Showing the first 15 of ${allGapFlags.length} gap flags. All of them are in the appendix. ` : "") +
            "Open items should be assigned to named owners with target resolution dates before this protocol is considered complete.",
        },
      },
      {
        title: "Next Scheduled Review",
        content: {
          nextReviewDate: field(answers, "Q_next_review", "Not specified — set before deployment"),
          monitoringReviewCadence: answers.Q_review_cadence || "Not answered — set the monitoring review cadence (weekly, monthly or quarterly)",
          protocolDocumentReview: "Review this protocol at least annually, and at every verification or revalidation",
          reviewOwner: answers.Q28 || "Not assigned",
        },
      },
      {
        title: "Regulatory References for This Deployment",
        content: {
          rationale: regulatoryReferences(answers),
          source: `Chosen from your answers, out of the Commons regulatory map (as of ${REG.asOf}; Section 1557, AB 3030 and the FDA CDS guidance re-checked ${SECOND_PASS_AS_OF}). The same map is on each node page of the Commons. Not legal advice; check the current source.`,
        },
      },
      {
        title: "Protocol Provenance",
        content: {
          generatedBy: "Healthcare Governance Commons — Validation Protocol Generator",
          generatedAt: new Date().toISOString(),
          commonsUrl: "healthcare-governance-commons.vercel.app",
          shelfLifeStatement: "This document has a shelf life. A validation protocol that is never updated is not a governance document — it is a record of past intentions.",
          referencesAsOf: `Regulatory and standards references in this protocol: Joint Commission + CHAI elements checked ${REFERENCES_AS_OF}; ONC HTI-5 (model cards) and ambient-scribe recording-consent cases checked ${MODELCARD_CONSENT_AS_OF}; Section 1557 §92.210, California AB 3030 and the FDA clinical decision support guidance checked ${SECOND_PASS_AS_OF}. Rules and standards change; check the current source before relying on this.`,
          versionStatement: "Version 1.0. Update this document at every verification or revalidation or when organizational context changes materially.",
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
