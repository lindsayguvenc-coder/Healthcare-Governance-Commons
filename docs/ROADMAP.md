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
- [ ] **Statistician: hire before the first of these.** Someone uses a tool's
      numbers to set up QC on a real system (e.g. a hospital sizing its
      baseline); a published piece cites a tool's numbers as evidence; or work
      starts on the Commons data component (frequency across sources,
      confidence per node). Until then, tools stay labeled working prototypes
      and get AI dress-rehearsal reviews. The Agent QC picker had one on
      Oct 28; its sigma step and expanded method library still need one.
- [ ] **PHI screening: next steps.** Oct 28 added a browser-side screen on every
      free-text field plus a server check (api/_phi.js) on the AI relay and
      contributions. Still to do: (1) the VPG upload check reads PDFs as plain
      text, so it sees compressed streams and misses PHI; use a real text
      extractor before uploads come back. (2) Real de-identification (names,
      dates and places in free prose) is a security-reviewer job, not regex.

## Report tools: content reset (added Oct 29, 2026)
Content review of the VPG: "VPG Content Review" doc. Done Oct 29: shared
disclaimer, PDF crash and garbled characters fixed, honest "not asked" blanks,
system name/vendor/version questions, governance-area grading switched off
(`NODE_GRADING_PAUSED`), Joint Commission + CHAI elements with as-of dates.
- [ ] **Metrics swap.** Adopt the Agent QC picker's set (intervals, sample
      size, calibration, per-group numbers); drop AUC-alone, F1, and the
      0.97/0.93 floors; add alert rate, override rate, net benefit. Label any
      default allowable error as a Commons position.
- [ ] **Short tracks by use type.** Ambient scribes (recording consent: 11
      all-party states) and agentic workflows.
- [ ] **Same content review for ROI, Consultation and the transition tools.**
- [ ] **Rebuild governance-area grading** against `src/data/nodes.json`.
- [ ] **Literature pass on metrics** for anything newer worth adding.
- [ ] **Face lift, last.** One consistent look across all report PDFs, once
      the content has settled.

