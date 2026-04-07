/**
 * PHI Detection API Route
 * Healthcare Governance Commons
 *
 * Scans uploaded document text and free text inputs for potential PHI.
 * Returns flagged entities with type, confidence, and recommended action.
 *
 * Confidence levels:
 *   HIGH   → hard block, do not proceed
 *   MEDIUM → soft warning, user must acknowledge
 *   LOW    → informational flag only
 *
 * Action levels:
 *   BLOCK  → stop processing, return error to user
 *   WARN   → surface warning, require acknowledgment
 *   FLAG   → log only, do not surface to user
 */

// PHI pattern definitions
// Each pattern has: type, regex, confidence, description
const PHI_PATTERNS = [

  // ── HARD BLOCK patterns ──────────────────────────────────────────────────

  {
    type: "SSN",
    pattern: /\b\d{3}-\d{2}-\d{4}\b|\b\d{9}\b/g,
    confidence: "HIGH",
    description: "Social Security Number",
  },
  {
    type: "MRN",
    // Common MRN formats: MRN followed by digits, or labeled patterns
    pattern: /\b(MRN|Medical Record|Record No|Patient ID|Pt ID)[:\s#]*\d{4,12}\b/gi,
    confidence: "HIGH",
    description: "Medical Record Number",
  },
  {
    type: "DOB",
    // Date of birth labeled patterns
    pattern: /\b(DOB|Date of Birth|Birth Date|Born)[:\s]*\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/gi,
    confidence: "HIGH",
    description: "Date of Birth",
  },
{
    type: "PHONE",
    pattern: /\b(\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    confidence: "MEDIUM",
    description: "Phone Number",
  },
  {
    type: "EMAIL",
    pattern: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
    confidence: "MEDIUM",
    description: "Email Address",
  },
  {
    type: "ADDRESS",
    // Street address patterns
    pattern: /\b\d{1,5}\s+[A-Za-z\s]{2,30}(Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl)\b/gi,
    confidence: "HIGH",
    description: "Street Address",
  },
  {
    type: "ZIP",
    pattern: /\b\d{5}(-\d{4})?\b/g,
    confidence: "MEDIUM",
    description: "ZIP Code",
  },

  // ── MEDIUM WARNING patterns ───────────────────────────────────────────────

  {
    type: "DATE",
    // Standalone dates that could be patient dates
    pattern: /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g,
    confidence: "MEDIUM",
    description: "Date (potential patient date)",
  },
  {
    type: "AGE",
    // Age patterns — "age 87" or "87 year old" — over 89 is PHI under HIPAA
    pattern: /\b(age[:\s]+[89]\d|[89]\d[\s-]year[\s-]old|aged?\s+[89]\d)\b/gi,
    confidence: "MEDIUM",
    description: "Age over 89 (HIPAA identifier)",
  },
  {
    type: "PATIENT_NAME",
    // Patient name label patterns
    pattern: /\b(Patient|Pt|Subject)[:\s]+[A-Z][a-z]+[\s,]+[A-Z][a-z]+/g,
    confidence: "MEDIUM",
    description: "Labeled patient name",
  },
  {
    type: "ACCESSION",
    pattern: /\b(Accession|ACC|Case)[:\s#]*[A-Z0-9]{6,12}\b/gi,
    confidence: "MEDIUM",
    description: "Accession or Case Number",
  },
  {
    type: "NPI",
    pattern: /\b(NPI)[:\s#]*\d{10}\b/gi,
    confidence: "MEDIUM",
    description: "National Provider Identifier",
  },
  {
    type: "DEA",
    pattern: /\b(DEA)[:\s#]*[A-Z]{2}\d{7}\b/gi,
    confidence: "MEDIUM",
    description: "DEA Number",
  },

  // ── LOW FLAG patterns ─────────────────────────────────────────────────────

  {
    type: "IP_ADDRESS",
    pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
    confidence: "LOW",
    description: "IP Address",
  },
  {
    type: "URL",
    pattern: /https?:\/\/[^\s]+/gi,
    confidence: "LOW",
    description: "URL (review for patient portal links)",
  },
];

// Context patterns that indicate document is likely a vendor doc (reduce false positives)
const VENDOR_DOCUMENT_INDICATORS = [
  /model card/i,
  /validation study/i,
  /performance evaluation/i,
  /instructions for use/i,
  /510\(k\)/i,
  /de novo/i,
  /sensitivity/i,
  /specificity/i,
  /auroc/i,
  /training (data|population|cohort)/i,
];

function isLikelyVendorDocument(text) {
  const indicatorCount = VENDOR_DOCUMENT_INDICATORS.filter((p) =>
    p.test(text)
  ).length;
  return indicatorCount >= 2;
}

function scanForPHI(text) {
  const findings = [];
  const isVendorDoc = isLikelyVendorDocument(text);

  for (const { type, pattern, confidence, description } of PHI_PATTERNS) {
    // Reset regex state
    pattern.lastIndex = 0;

    const matches = [...text.matchAll(pattern)];
    if (matches.length === 0) continue;

    // If vendor document indicators present, downgrade confidence one level
    // to reduce false positives on things like validation study date ranges
    let effectiveConfidence = confidence;
    if (isVendorDoc && confidence === "HIGH") {
      effectiveConfidence = "MEDIUM";
    }
    if (isVendorDoc && confidence === "MEDIUM") {
      effectiveConfidence = "LOW";
    }

    findings.push({
      type,
      description,
      confidence: effectiveConfidence,
      count: matches.length,
      // Return first match as example (redacted to 6 chars for safety)
      example: matches[0][0].substring(0, 6) + "...",
      action:
        effectiveConfidence === "HIGH"
          ? "BLOCK"
          : effectiveConfidence === "MEDIUM"
          ? "WARN"
          : "FLAG",
    });
  }

  return {
    findings,
    isVendorDocument: isVendorDoc,
    hasBlockingFindings: findings.some((f) => f.action === "BLOCK"),
    hasWarningFindings: findings.some((f) => f.action === "WARN"),
    summary: buildSummary(findings, isVendorDoc),
  };
}

function buildSummary(findings, isVendorDoc) {
  if (findings.length === 0) {
    return {
      status: "CLEAR",
      message: "No PHI patterns detected.",
    };
  }

  const blocking = findings.filter((f) => f.action === "BLOCK");
  const warning = findings.filter((f) => f.action === "WARN");

  if (blocking.length > 0) {
    return {
      status: "BLOCK",
      message: `This document may contain protected health information (${blocking
        .map((f) => f.description)
        .join(
          ", "
        )}). Please review and remove any patient-identifiable data before uploading. Validation protocol documents should not contain patient-level data.`,
    };
  }

  if (warning.length > 0) {
    return {
      status: "WARN",
      message: `This document contains patterns that may include identifying information (${warning
        .map((f) => f.description)
        .join(
          ", "
        )}). Please review before continuing. If this is a vendor document containing study dates or statistical identifiers, you may proceed.`,
      requiresAcknowledgment: true,
    };
  }

  return {
    status: "FLAG",
    message: "Minor patterns detected. Logged for review.",
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { text, source } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Text content required" });
    }

    // Enforce reasonable size limit — 500KB of text
    if (text.length > 500000) {
      return res.status(400).json({ error: "Content too large for PHI scan" });
    }

    const result = scanForPHI(text);

    // Log to console for Vercel function logs — never log the actual text
    console.log(
      `PHI scan completed. Source: ${source || "unknown"}. Status: ${
        result.summary.status
      }. Findings: ${result.findings.length}`
    );

    return res.status(200).json({
      ...result,
      scannedAt: new Date().toISOString(),
      source: source || "unknown",
    });
  } catch (err) {
    console.error("PHI scan error:", err.message);
    return res.status(500).json({ error: "PHI scan failed: " + err.message });
  }
}
