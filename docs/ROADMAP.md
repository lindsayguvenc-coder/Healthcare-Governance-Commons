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
      and the subgroup trigger, where the VPG flags a group more than the tier
      warning % from aggregate and the Setup uses 10 percentage points judged
      on intervals. Pick one. Forwarding `/agent-qc` to `/qc-setup`: deferred.
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
        minimum subgroup 30, subgroup review gap 10 points, 20 runs per
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
- [ ] **Same content review for ROI and Consultation.**
- [ ] **Check thinking vs. max_tokens on every other AI tool.** Sonnet 5.5's
      thinking spends the max_tokens budget. Transition charters cut off at
      2,500 tokens on Nov 4 until thinking was turned off for them. ROI,
      Consultation, map Synthesize and the Collaborator still ask for 2,500.
- [x] **Transition tools review (Nov 4).** Shared disclaimer, grey "not
      assessable" score, lived experience shown, "Can't tell from this" instead
      of invented detail, charter as a draft to mark up, AI text escaped.
- [ ] **Rebuild governance-area grading** against `src/data/nodes.json`.
- [ ] **Section 6 readiness verdict.** Computed but never printed, and it can
      disagree with the overall rating. Decide: print it, merge it with the
      rating, or remove it. (Carried from Oct 29.)
- [ ] **Literature pass on metrics** for anything newer worth adding.
- [ ] **Face lift, last.** One consistent look across all report PDFs, once
      the content has settled.

