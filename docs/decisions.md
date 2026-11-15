# Decisions in the tools

Generated from the `DECISION(id):` markers in the code by `node scripts/pr-guards.mjs --write-decisions`; don't edit by hand. Why these exist: [principles.md](principles.md). Read this at the Monday review: is each one meant, disclosed, and as late as it can be?

| Decision | Where | What and why |
|---|---|---|
| contribution-id | api/_queue.js | a random suffix keeps contribution ids unique. It's an id only; it never feeds a number in any report. |
| rule-power-grid | api/_rule-power.js | grid step 0.002 SD over about ±9 SD; good to about 1 in 10,000, checked against the closed form and a seeded simulation in check.mjs. |
| rule-power-model | api/_rule-power.js | control results are treated as independent normal z-scores around the baseline mean. Disclosed in the protocol next to the rates. |
| rule-power-window | api/vpg-engines.js | rates are given over a 10-run window, kept from the original simulation. Stated in the protocol. Not yet tied to how often this hospital runs controls (the fail-count rule uses 20); a candidate to set from the answers later. |
