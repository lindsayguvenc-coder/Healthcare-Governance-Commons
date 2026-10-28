// api/_phi.js — shared screen for patient information in free text.
// This is a screen for obvious slips, not de-identification. It runs in the
// browser first (public/phi-guard.js keeps a copy of these patterns) and again
// here, so text with clear identifiers is refused before it reaches the AI or
// the database. Strong patterns block; the browser also warns on weak ones.
const MONTH = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const DATE = `(?:\\d{1,2}[\\/\\-.]\\d{1,2}[\\/\\-.]\\d{2,4}|${MONTH}\\.?\\s+\\d{1,2},?\\s+\\d{4}|\\d{1,2}\\s+${MONTH}\\.?\\s+\\d{4})`;

const STRONG = [
  { re: /\b\d{3}-\d{2}-\d{4}\b/, why: "a Social Security number" },
  { re: /\b(MRN|medical record(?: number| no\.?)?|record no\.?|patient id|pt id)[:\s#]*[A-Z]?\d{4,}/i, why: "a medical record number" },
  { re: new RegExp(`\\b(DOB|D\\.O\\.B\\.|date of birth|birth ?date|born(?: on)?)[:\\s]*${DATE}`, "i"), why: "a date of birth" },
  { re: /\b(?:[Pp]atient|[Pp]t|[Ss]ubject|[Nn]ame)\s*[:\-]\s*[A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+/, why: "a patient name" },
  { re: /\b(accession|acc\.?|specimen id|case no\.?)[:\s#]*[A-Z0-9-]{6,}/i, why: "an accession or specimen number" },
  { re: /\b\d{1,5}\s+(?:[A-Z][a-z]+\s){1,3}(Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl)\b\.?/, why: "a street address" },
];

function strongHit(text) {
  const t = String(text || "");
  for (const p of STRONG) if (p.re.test(t)) return p.why;
  return null;
}

// Every string inside a request body, flattened (for screening user content).
function strings(v, out = []) {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => strings(x, out));
  return out;
}

const REFUSAL = (why) =>
  `This looks like it includes ${why}. These tools don't need patient information, so remove it and try again.`;

module.exports = { strongHit, strings, REFUSAL };
