# Decisions in the tools

Generated from the `DECISION(id):` markers in the code by `node scripts/pr-guards.mjs --write-decisions`; don't edit by hand. Why these exist: [principles.md](principles.md). Read this at the Monday review: is each one meant, disclosed, and as late as it can be?

| Decision | Where | What and why |
|---|---|---|
| contribution-id | api/_queue.js | a random suffix keeps contribution ids unique. It's an id only; it never feeds a number in any report. |
| kit-soft-pause | public/local-validation/index.html | the pause is a soft lock on purpose (Nov 14, 2026). Anyone who adds ?review=1, or reads the public code, can open the kit; someone working that hard to load an unreviewed kit into their own systems is past what a lock could stop. The pause is for ordinary visitors, and the daily site health check makes sure it stays on. |
| protocol-date | api/generate-protocol.js | the protocol is dated with the person's own calendar date, sent by the page (clientDate, YYYY-MM-DD). The server runs on UTC, so its own date is tomorrow for a protocol made on a California evening. If the page sends no valid date, the server's UTC date is used and labeled "(UTC)". |
| rule-power-grid | api/_rule-power.js | grid step 0.002 SD over about ±9 SD; good to about 1 in 10,000, checked against the closed form and a seeded simulation in check.mjs. |
| rule-power-model | api/_rule-power.js | control results are treated as independent normal z-scores around the baseline mean. Disclosed in the protocol next to the rates. |
| rule-power-window | api/_vpg-engines-core.js | rates are given over a 10-run window, kept from the original simulation. Stated in the protocol. Not yet tied to how often this hospital runs controls (the fail-count rule uses 20); a candidate to set from the answers later. |
