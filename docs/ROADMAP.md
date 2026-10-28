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
