# Commons upkeep: what runs, and what still needs building

The Commons governs itself with its own dual loop. Checks and agents are the
internal loop: they watch, flag, and propose. Lindsay is the external loop:
she approves, decides, and stops. Nothing an agent finds goes live without her.

## Running now
- **Drift checks** (`scripts/check.mjs`, on every pull request and Mondays):
  every node has a map position, regulatory entry, and toolbox entry; every
  internal link resolves; data files agree; the regulatory layer is under six
  months old; absolutes like "almost universally" get flagged.

- **Weekly backup** (.github/workflows/weekly-backup.yml, Sunday nights):
  published contributions, the decision log, and stats are saved to the
  data-archive branch; only then are the archived log entries cleared.

## To build (decided Oct 27, 2026)
- [ ] **Weekly currency scan.** Federal Register, FDA guidance, CMS, state AI
      laws, EU AI Act against `src/data/regulatory.json`. Opens a pull request
      or report for review. Feeds the Movement box.
      - *Option B (Oct 29, to decide Nov 4):* broader weekly sweep, one lane
        per kind of update: legislation, clinical practice, healthcare
        operations, industry, global standards. Checks every as-of date the
        Commons cites (starting with `REFERENCES_AS_OF` in
        `api/generate-protocol.js`) and flags what moved. Lindsay reviews the
        findings as they come in and adjusts plans from them.
- [ ] **Monthly claims audit.** Re-verify everything labeled Sourced; chase
      Needs-source items. Must be a separate agent from anything that writes
      content (the checker is never the writer).
- [ ] **Monthly forming scan.** Open questions plus new literature, looking
      for clusters that might be a new node. Proposes only; naming a node is
      Lindsay's call.
- [ ] **Review queue triage.** The queue exists (node page buttons → private
      Intake tab, approve or reject). Still to build: an agent that pre-screens
      for spam and patient data, catches duplicates, summarizes, and suggests a
      node, so review is faster. Lindsay still decides.
- [x] **Two-reader recommendation (Oct 27).** Each contribution gets two
      independent AI reads (fit, skeptic). Agreement: one click accepts it.
      Split: Lindsay breaks the tie. Every decision is logged without content
      (suggest:decisions) so agreement and override rates can be measured.
- [ ] **Video replays on every pull request.** tests/replay records the review
      flow locally with mocks today. Next: run it in GitHub Actions against the
      Vercel preview with real services and attach the video to the PR. Needs a
      Vercel "Protection Bypass for Automation" secret added to GitHub.
- [ ] **Multi-level escalation pathway.** Once the decision log shows Lindsay
      reliably agrees with consensus for a given type or domain, that tier can
      auto-pass with spot audits, the way a lab moves a stable assay to reduced
      QC frequency. Splits and overrides always escalate to a person.
- [ ] **Revisit auto-approval when review volume justifies it.** Decided Oct 27:
      everything stays manual for now. First candidate: sources from allowlisted
      domains (.gov, PubMed/PMC, DOI, FDA, NIH, WHO), publishing the link with
      the source's own title and still holding the submitter's text for review.
      Questions second, after triage screening. Notes and tools never automatic.
- [ ] **Claim labels as data.** Sourced / Field consensus / Commons position /
      Needs source as a field on each claim, so the checks can enforce them.

## Missing tools: gap assessment (Nov 13, 2026)
Checked against the seven elements of the Joint Commission + CHAI guidance
(Responsible Use of AI in Healthcare, Sept 17, 2025; voluntary, expected to
shape a certification program) and the Commons nodes. Covered today: policies
and governance structure (Charter Starter, Container Health Check,
Disagreement Unpacker), risk and bias assessment (VPG, kit per-group results),
pre-deployment validation (VPG, kit when it reopens), value (ROI).

Gaps, in priority order:
- [ ] **Monitoring: bring the healthcare version home** (element 4; Watcher,
      Threshold Review, Equity nodes). Lindsay: already made. The Commons has
      step 1 (Agent QC Setup, marked Prototype); the general version became her
      own Agent QC Monitor (tool maker, runner, dashboard). Make the
      healthcare-specific monitor available here once those steps prove out.
- [ ] **AI inventory and risk tiering** (element 1; Accountability,
      Authority). The front door: what AI is in use, who owns it, how risky,
      which reviews it needs. Also the starting list for Section 1557's duty to
      identify tools that use protected inputs.
- [ ] **Safety event and override log** (element 5; Override, Stop, Cold
      Trigger, Learning Loop). Lindsay found something someone else made to
      borrow concepts from (in past chats; still to locate). Her notes from
      Oct: healthcare already classifies events well, near-miss included; and
      reviewers should watch for business or personal complaints recast as
      incidents to get traction.
- [ ] **Threshold re-check** (Threshold Review). From local scores and
      labels, show sensitivity, PPV and alert volume at each threshold. Small
      once the kit is reviewed; same data. Same treatment as the kit: paused
      until reviewed, with a stamped "see how it works" sample.
- [ ] **Patient notice and challenge pathway** (element 2; Contestation,
      Explainability). On hold: Lindsay has views on consent to settle first. Plain-language disclosure drafts, when consent applies,
      how a patient questions an AI-influenced decision. State rules differ;
      examples only, not legal advice.
- [ ] **Role-specific training sheet** (element 7). Only if it's helpful. One page per tool per
      role: what it does, its limits, when to override, who to tell. Could
      draw on the VPG answers and the Urban Thesaurus.
- [ ] **Vendor contract terms already exist** (element 3; Vendor Risk):
      "Feed It to the Beast: Procurement" (57 sourced clauses) at
      lab-rules-map/vendor-contracts. The Commons links it only from node
      toolboxes, under an older name ("Buy AI Like Reagents"). Give it a Tools
      page card and fix the name.

## Tools: rebuild once-over (added Oct 28, 2026)
- [ ] **Once-over of every tool.** All tools were first passes: Validation
      Protocol Generator, ROI Assessment, Peer Challenge Registry, Facetious
      Collaborator, the transition tools, node pages, and the Agent QC Metric
      Picker. Review each for correctness and "decent," not just working.
- [ ] **VPG ↔ Agent QC hand-off.** The Validation Protocol Generator verifies
      vendor claims before go-live; the Agent QC picker monitors after. The
      picker's "vendor's claimed failure rate" should come from the VPG's
      model-card answers instead of being asked twice.
      Nov 12: the Agent QC Setup (`/qc-setup`) now holds the picker's
      statistics plus lanes and the response layer, and the VPG's "set at
      validation" lines quote the Setup's starting values. Still open: one
      source per value (the QC plan holds the number, the VPG carries it in),
      Subgroup trigger decided Nov 12: both tools use a ratio on the error rate
      (starting value 1.5× aggregate) for size, plus the group's 95% interval
      clearing the aggregate rate, confirmed on the next window, for evidence. `/agent-qc` now forwards to `/qc-setup` (Nov 12); the old page's file stays in the repo for reference.
- [ ] **Statistician: hire before the first of these.** Someone uses a tool's
      numbers to set up QC on a real system (e.g. a hospital sizing its
      baseline); a published piece cites a tool's numbers as evidence; or work
      starts on the Commons data component (frequency across sources,
      confidence per node). Until then, tools stay labeled working prototypes
      and get AI dress-rehearsal reviews. The Agent QC picker had one on
      Oct 28; its sigma step and expanded method library still need one.
      **Review list for the statistician** (what each tool uses now, and where):
      - VPG confidence intervals: **Wilson score, 95%** (`wilson()` in
        `api/vpg-engines.js`), on sensitivity, specificity, alert rate and
        PPV. Chosen Nov 12, 2026 over Clopper-Pearson because it is closed-form
        and fast on validation sets in the tens of thousands; the picker allows
        either. Confirm the choice, especially for small groups and rates near
        0% or 100%, where the two differ most.
      - Agent QC picker confidence bounds: **Clopper-Pearson, 95%**, by
        bisection over an exact binomial tail (`cpBound()` in
        `public/agent-qc/index.html`). The two tools now use different
        methods; decide whether they should match.
      - VPG net benefit: Vickers decision-curve form, net benefit =
        sensitivity × prevalence − (1 − specificity) × (1 − prevalence) × 1/N,
        where N = false alarms accepted per caught case (threshold probability
        1/(1+N)). Compared against treat-all and treat-none. No interval on net
        benefit yet.
      - VPG PPV, NPV and alert rate: computed at the local prevalence (band
        midpoint if a range was picked), not the validation set's. Check
        whether band midpoints are acceptable.
      - VPG allowable error: 3/7/12% (high), 5/12/20 (moderate), 8/18/30 (low),
        scaled ×0.75 / ×1.3 by tier sensitivity. No source; labeled "Commons
        position, not a standard". Replace or defend.
      - VPG "monitoring rule set performance" figures (false rejection ~5.9%,
        1 SD / 2 SD shift detection ~44.9% / ~98.6% in 10 runs) come from a
        simulation in `simulateRuleSetPerformance()` in `api/vpg-engines.js`.
        Check the simulation and its assumptions.
      - VPG floors: none by default since Nov 12 (the old 0.97/0.93 trims had no
        source). Hospital sets its own.
      - Agent QC Setup (`/qc-setup`, Nov 12): the picker's engine moved in
        unchanged (Levey-Jennings simulation, binomial count limits,
        drift-sensor limits with Clopper-Pearson, simplified sigma tiers). The
        Setup's own set-point figures use Wilson intervals and one-sided exact
        zero-failure bounds, so one page now uses both methods. Also review
        the starting values: control set 12, stop-using 95%, agreement 95%,
        minimum subgroup 30, subgroup ratio 1.5× aggregate error rate (with the interval rule), 20 runs per
        required-behavior control, warning deadline 1 business day,
        contingency reminders 24 h / 72 h / 7 days.
- [ ] **PHI screening: next steps.** Oct 28 added a browser-side screen on every
      free-text field plus a server check (api/_phi.js) on the AI relay and
      contributions. Still to do: (1) the VPG upload check reads PDFs as plain
      text, so it sees compressed streams and misses PHI; use a real text
      extractor before uploads come back. (2) Real de-identification (names,
      dates and places in free prose) is a security-reviewer job, not regex.

## Report tools: content reset (added Oct 29, 2026)
Reports turn back on per tool: each tool is listed in `PAUSED_IN_CODE` in
`api/_pause.js` and comes off that list in the PR that finishes its review.
`REPORTS_PAUSED` in Vercel is now only the emergency switch.
Content review of the VPG: "VPG Content Review" doc. Done Oct 29: shared
disclaimer, PDF crash and garbled characters fixed, honest "not asked" blanks,
system name/vendor/version questions, governance-area grading switched off
(`NODE_GRADING_PAUSED`), Joint Commission + CHAI elements with as-of dates.
- [x] **Metrics swap.** (Done Nov 12, 2026, PR #24.) Adopt the Agent QC picker's set (intervals, sample
      size, calibration, per-group numbers); drop AUC-alone, F1, and the
      0.97/0.93 floors; add alert rate, override rate, net benefit. Label any
      default allowable error as a Commons position.
- [x] **Short tracks by use type.** (Done Nov 12, 2026, PR #24: Section 3 branches on use type; scribe and agent tracks with their own measures and flags.) Ambient scribes (recording consent: 11
      all-party states) and agentic workflows.
- [x] **ROI content review (Nov 13, 2026).** Ratings and the measured/assumed/unknown
      map now come from fixed rules on the answers; AI only writes summaries,
      strengths, gaps, the overall paragraph and (strategy documented and in use,
      priorities picked) recommendations, all labeled AI-written. Fixed: every run
      failing on the thinking block, cut-offs (thinking off for ROI), the leaky
      strategy gate ("in development" no longer gets recommendations), required
      questions not enforced, missing "Unknown" options, duplicate subgroup
      question, method mixed with result, AI-invented report date, cursor lost
      while typing, unsourced "no ROI framework exists" claim, privacy line that
      left out the AI. Added: shared disclaimer, scribe/agent/admin use types with
      scribe and agent questions, alert and override rate, the cost of checking
      the tool (net vs. gross), grey "too little to assess", a check when the
      self-rated overall evidence is higher than the answers support. Second
      pass (same day, from the 2025-26 ROI debate: PHTI scribe report, coding
      intensity analyses, Bain/Bessemer scorecard, validation-burden writing):
      who pays for higher coding (audit, clinician sees codes, cost to patients
      and payers), actual use vs. licensed seats, where saved time went, time
      spent checking/supervising and by whom (net time), baseline before
      go-live, burnout surveyed before/after, cost of leaving and alternatives
      (incl. EHR built-in), payoff and re-check dates, plus a rule-based
      "What your answers flag" list. Replay: `tests/replay/record-roi.js`.
- [x] **ROI: real runs, then unpause (Nov 13).** Five made-up organizations
      through the real relay and model (`tests/replay/real-roi.js`): scribe,
      sepsis model, pre-adoption CT triage, prior-auth agent, thin intake. All
      complete (1,000-1,900 output tokens of 3,500, no thinking), no invented
      facts, no re-grading, recommendations only where allowed. Fixed after:
      "unknown" was being written up as "no baseline"; about 1 in 4 replies for
      one case dropped a closing bracket, so the page now repairs brackets,
      lifts misplaced fields, and retries once. Then 10 more real runs, 10 of
      10 clean. "roi" is off
      `PAUSED_IN_CODE`, so merging the review PR turns ROI reports on.
- [ ] **ROI: measured overhead rates.** The report says savings are gross until
      the cost of checking the tool is subtracted, but applies no number. Once
      there are measured examples per system type, add an estimated overhead
      percentage per category (cost-of-quality idea, Nov 4).
- [ ] **ROI rating rules → statistician / domain review list.** The rules
      (e.g. outside peer-reviewed evidence caps at "moderate" before local data;
      no baseline caps local measurement at "moderate"; a missing cost caps
      financial at "weak"; unaudited coding gains, low or untracked use, or a
      cost that leaves out checking cap financial at "moderate"; untracked harm
      caps equity at "moderate"; a before/after burnout survey lifts
      non-monetary to "moderate") are Commons positions, not a standard.
- [x] **Consultation (Governance Assessment) retired (Nov 13, 2026).** Scrapped
      instead of reviewed: a big intake feeding 10 AI essays, mostly covered
      better now by the VPG, QC Setup and Transition tools. `/consultation`
      redirects to `/tools`. The old page is in git history. Rescued pieces are
      parked under "Rescued from the Consultation tool" below.
- [ ] **Check thinking vs. max_tokens on every other AI tool.** Sonnet 5.5's
      thinking spends the max_tokens budget. Transition charters cut off at
      2,500 tokens on Nov 4 until thinking was turned off for them. ROI is
      off too (Nov 13). Map Synthesize and the Collaborator still ask for 2,500.
- [x] **Transition tools review (Nov 4).** Shared disclaimer, grey "not
      assessable" score, lived experience shown, "Can't tell from this" instead
      of invented detail, charter as a draft to mark up, AI text escaped.
- [ ] **Rebuild governance-area grading** against `src/data/nodes.json`.
- [x] **Section 6 readiness verdict (Nov 13).** Now printed, and computed from
      the deployment conditions listed under it, so the two can't disagree. The
      old version counted paused governance nodes.
- [x] **VPG second content pass, decisions built (Nov 13).** New questions:
      autonomy level (sets HIGH_AUTONOMY / DIRECT_CLINICAL_DECISION, which the
      tier engine already used but nothing set), FDA status (incl. PCCP and
      non-device CDS), what the vendor disclosed about training patients (fills
      the bias table), protected-class inputs (Section 1557 §92.210), AI-written
      messages to patients (California AB 3030), known limits. Monitoring:
      outcome measure, four contract terms (performance data, update notice,
      data use and retention, suspend without penalty), retirement plan. Gap
      flags for each. Regulatory references now come from
      `src/data/regulatory.json`, chosen by the answers, verified entries only.
      Replay: `tests/replay/record-vpg-second.js` (17 checks, real engines and PDFs).
      Plus an "At a Glance" page after the cover: verdict, key facts, what must
      close before go-live, the first open items. All repeated from the sections.
- [x] **Local Validation Kit v1 (Nov 13, 2026)** at `/local-validation/`. Gets
      hospitals the four counts the VPG needs from their own patients. Rules
      label most encounters; a person reviews only the can't-tell cases plus a
      blind audit sample that measures the rules; optional second reviewer for
      Cohen's kappa. Runs entirely in the browser: the page's security policy
      blocks all network requests (`connect-src 'none'`). Counts (numbers only)
      hand off to the VPG in the same browser, and the VPG records where they
      came from. Rule packs are plain data run by one engine
      (`public/local-validation/engine.js`): columns, a gate (all must hold),
      criteria (any one is enough), three-valued so a blank never decides a
      case, and "near" margins that send close calls to a person. The page
      writes each pack's rules out in plain English for clinician sign-off,
      shows its sign-off status, and lets a hospital load its own pack from a
      file (validated, stays in the browser). First pack: sepsis after the CDC
      Adult Sepsis Event (`public/local-validation/sepsis-ase.js`). Ships with SQL and FHIR
      starting points and 800 made-up encounters
      (`scripts/make-sample-sepsis.py`). Replay: `tests/replay/record-lvk.js`.
- [x] **Kit: security hardening (Nov 13, 2026).** Offline single-file copy
      (`local-validation-kit-offline.html`, built by
      `scripts/build-kit-offline.mjs`, deterministic) with `default-src 'none'`,
      so it can't load or send anything; its SHA-256 is published next to it
      and shown on the online page. `npm run check` fails if the committed
      offline copy is stale. Downloads are spreadsheet-safe (formula injection
      neutralized). Security notes for hospital IT on the page, including the
      one thing the page can't control: browser extensions. Checks:
      `tests/replay/check-kit-security.js`.
- [ ] **Two-factor login on GitHub and Vercel** (Lindsay): the offline copy
      protects hospitals from a changed website, but 2FA is what protects the
      website.
- [x] **Kit paused for review (Nov 13, 2026).** Public page, offline copy, Tools
      card and VPG note all show it as paused; the tool itself only appears with
      `?review=1` (for reviewers). Unpause = remove the gate in
      `public/local-validation/index.html`, restore the Tools card and VPG note,
      rebuild the offline copy. Opens only after both reviews below.
- [x] **Kit: "See how it works" on the paused page (Nov 13, 2026).** Four
      screenshots and a 30-second replay from the made-up sample, every one
      stamped "made-up data · not validated" top and bottom so a crop still
      says it. Built by `scripts/make-kit-howto.py` from a `record-lvk.js` run.
      Shown only while paused; not in the offline copy.
- [x] **Privacy and labeling sweep (Nov 13, 2026).** Rate-limit counter keyed
      on a scrambled IP, never the raw address. Server logs no longer record PDF
      filenames (they can carry a patient's name) or free-text labels. Every AI
      tool page now says answers go to an AI model and to leave out patient
      details. Kit downloads from an unsigned pack say DRAFT in the file name.
      Privacy notice covers the kit.
- [x] **Tools cleanup (Nov 13, 2026).**
      - Governance Architecture: Westgard rules corrected (1-2s is one result
        past 2 SD and only a warning; 2-2s and R-4s described properly),
        example windows and cadences labeled as examples, unsupported
        "required for accreditation" claim removed. Off the Tools page; it's
        Episode 07's interactive figure.
      - Peer Challenge Registry: now a paused preview. Demo entries rewritten
        with invented organizations and generic system types (the old ones
        named real products and a real health system with made-up results).
        Sign-up form viewable but disabled; introductions shown as paused.
      - Document upload removed from the VPG, with its `phi-check` and
        `strip-metadata` endpoints. Uploaded files never fed the protocol.
- **Removed (Nov 13, 2026), kept here so they're tracked:**
      - `public/agent-qc/index.html`: the old Agent QC Metric Picker, kept
        "for reference" after `/qc-setup` replaced it. `/agent-qc` still
        forwards.
      - `public/checklist.html`: an index of three checklists that were never
        on the site; its doc-library entry went with it.
      - `api/phi-check.js`, `api/strip-metadata.js`: upload-only endpoints.
- [ ] **Checklist recovery ×3** (not for the site; needed as source
      material). All three are in Lindsay's Drive, March 2026 originals in
      one folder and Aug 31 copies in another:
      - Healthcare AI Governance Checklist (`governance_checklist.html`, also
        a .docx)
      - Bias & Demographic Fairness Checklist
        (`bias_demographics_checklist.html`)
      - Healthcare Data Quality & Provenance Checklist
        (`healthcare_data_checklist_v2.html`; a shorter `-1` copy exists too)
      - plus the index that tied them together
        (`governance_commons_checklists.html`, several numbered copies).
      Next: pick the canonical copy of each, check them against today's
      Commons, decide where they live.
- [ ] **Episode 07 PDF has the same errors as the old Architecture page**
      (the 1-2s and R4s wording, "required for accreditation", fixed hours).
      It's Lindsay's published piece: her call whether to post a correction.
- [ ] **Rename the Facetious Collaborator** (Lindsay loves it; needs a new
      name). It lives on every node page, not the Tools page. Consider a
      Tools-page card so people can find it.
- [ ] **Clinician sign-off on the sepsis rule pack** before anyone relies on its
      labels. Includes the "too close to call" band (within 10% of a cutoff),
      the antimicrobial-day handling, and the baselines in the SQL notes.
- [x] **Kit: audit sized by precision (Nov 13).** The user sets "show the rules
      are at least X% accurate" (default 90%) and an assumed accuracy (95%);
      the audit is the smallest sample whose Wilson interval would clear X
      (127 cases at the defaults). If it falls short: fix, then re-audit (decided
      Nov 13). The page lists the disagreements; after the rules or query are
      fixed, a fresh audit draws new cases only, and earlier audit cases stop
      counting toward rule accuracy. No topping up an audit after a first look.
- [ ] **Statistician: the kit's math.** Wilson intervals, the audit-size
      search, whether the fresh re-audit design needs any correction, Cohen's
      kappa on a 20% second-review sample, and the 10% "near" margin.
- [ ] **More rule packs**, one at a time, each with a clinician's sign-off:
      imaging triage, deterioration, readmission.
- [x] **VPG unpaused (Nov 13, 2026).** Rule-based, no AI. Open statistician
      items (simulation figures, Westgard defaults, interval method) are
      labeled in the report as Commons positions. Every report tool is now on;
      `REPORTS_PAUSED` in Vercel is still the emergency switch.
- [ ] **Literature pass on metrics** for anything newer worth adding.
- [ ] **Face lift, last.** One consistent look across all report PDFs, once
      the content has settled.


## Rescued from the Consultation tool (parked Nov 13, 2026)
The Consultation tool was retired, not rebuilt. These are the parts worth keeping.
Nothing here is scheduled yet. The old wording is in git history
(`public/consultation/index.html`, before the retire-consultation PR).

- [ ] **Dissent Surface.** The best part of the old tool. For each stakeholder
      group: the concern, stated as a signal worth taking seriously; what taking
      it seriously looks like; the change-management implication. Keep the
      workforce paragraph as written, especially: "We have no plans for layoffs"
      is not a governance response; a governance response describes what
      structural commitments protect workforce interests. Could be its own small
      tool, or a section the other report tools borrow.
- [ ] **Readiness questions no other tool asks.** Could become a short
      fixed-rules "ready to govern this?" check (flags, no AI), or get folded
      into Transition or the VPG:
      - Is there a named person with formal authority to halt a deployed tool?
      - Has anyone been held formally accountable for an AI-related event?
      - Has a staff concern ever changed a deployment or governance decision?
      - How much tolerance is there for pausing or rolling back a tool?
      - Is AI governance framed as compliance, patient safety, or both?
      - Is there a policy on unsanctioned (shadow) AI use, and has anyone
        checked what staff actually use?
      - What does success look like at 90 days and at 1 year, measured how,
        and decided by whom?
      - What would make you conclude the deployment failed?
      - What haven't you found a governance answer to yet?
- [ ] **Culture-of-safety anchor.** Tie AI readiness to the safety culture
      survey the organization already runs (AHRQ SOPS or similar): weakest
      domains, especially non-punitive response to error and communication
      openness. Two or three questions somewhere else, not a whole section.
      Note: SAFER Guides are ONC's, not the Joint Commission's (the old tool
      had this wrong).
