# Library seeding rules

The document library (`src/data/library.json`) is the one source for every
document the Commons links: the Doc Repository tab, the node pages, and the
node synthesis panel all read from it. Node files no longer carry their own
evidence lists.

Rebuilt from scratch Nov 14, 2026.

## What gets in

**Tier: primary.** The original document from whoever issued it:
- regulators and their guidance (FDA, ONC, HHS OCR, CMS, EU, state law text)
- standards and accreditation bodies (IMDRF, NIST, Joint Commission, ISO)
- professional and licensing bodies (AMA, FSMB)
- peer-reviewed papers and preprints, cited to the paper itself

Not in: news stories, law-firm summaries, blogs, vendor material, op-eds and
columns. They can be used to find a primary source; they are never the source.

**Tier: commons.** Lindsay's own work (Community Weaving, the tools, the
mechanisms index, the ECG demo). Always labeled as hers, kept separate, and
never counted as outside evidence for a claim.

## Every entry carries
- `status`: final, draft, superseded, in force, partially vacated, preprint, etc.
- `date`: the document's own date (or version date)
- `verified`: the day someone checked the link and the status against the source
- `abstract`: written in Commons words, not copied; says what the document
  actually is (a letter is a letter, an editorial is an editorial)
- `nodes`: which nodes it informs

Library-wide `asOf` is the date of the last full sweep.

## Re-check
- Anything with `status` draft, proposed, or pending: re-check monthly.
- Everything else: re-check at least every six months (same limit the
  regulatory layer uses). The drift check (`npm run check`) warns at five
  months and fails at six.
- A source that changes status keeps its entry; update `status`, `date`, and
  the abstract. A superseded source moves to `retired` with the reason.

## Retired in the Nov 14, 2026 rebuild
| Old entry | Why |
|---|---|
| IHI "Bringing Safety to AI: Adapting Patient Safety Principles…" | No document by that title. Replaced by the real IHI Lucian Leape Institute report, *Patient Safety and Artificial Intelligence: Opportunities and Challenges for Care Delivery* (May 2024). |
| HAIP "Principles for Responsible AI Governance in Health Systems" | No document by that title; link went to the homepage. Replaced by HAIP's Key Decision Points guides and the peer-reviewed HEAAL framework. |
| Apollo "AI Behind Closed Doors: Evaluating AI Systems in Deployment" | Misdescribed. The real report (Stix et al., Apr 2025) is about AI developers governing their own internal use, not deployed clinical systems. Not linked to any node. |
| FDA Clinical Decision Support Software (2022) | Superseded by the revised final guidance of Jan 6, 2026. |
| FDA GMLP Guiding Principles (2021) | Folded into IMDRF N88 (Jan 2025), the final international version. |
| Dorn, "How Collective Intelligence Could Soon Reshape Medical Decision-Making" (Forbes, 2026) | Column, not a primary source. Distilled summary moved to `docs/retired/`. |
| Node-level evidence lists in `nodes.json` | Duplicated the library and drifted from it. Nodes now pull from the library by tag; `keyDocs` picks the lead documents. |
