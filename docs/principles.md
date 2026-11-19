# How the Commons tools make their numbers

Set Nov 14, 2026, after the Validation Protocol Generator was found printing
detection rates from a random simulation that used its own copy of the QC
rules (fixed in PR #61).

## Decide late and out loud

Estimates and judgment calls are allowed. Some are necessary. What isn't
allowed is a decision nobody made on purpose: a rule copied instead of read
from its source, an unseeded random draw, a default standing in for an answer,
a rounding that hides a difference.

So every decision in a tool that feeds a report:

1. **Comes as late in the chain as it can.** Work from the real inputs as far
   as they go; estimate only where they run out.
2. **Is named.** It's marked in the code with a `DECISION(id):` comment that
   says what was chosen and why.
3. **Is disclosed** in the report the person gets, wherever it changes what
   they'd conclude. If something can't be calculated, the report says so
   rather than guessing.
4. **Lives in one place,** so it can be found and optimized backwards later.
   Every marked decision is listed in [decisions.md](decisions.md), which is
   rebuilt from the code and checked on every pull request.

Speed comes after this. It's fine to block a tool and re-figure the
efficiency; it isn't fine to cut an edge nobody can find again.

## What the checks catch, and what they can't

`scripts/pr-guards.mjs` (D1) fails a pull request when:

- code in `api/` or a tool page uses `Math.random` without a `DECISION`
  marker on that line or the line above it, and
- `docs/decisions.md` doesn't match the markers in the code (a decision was
  added, changed or removed without the ledger showing it).

That catches the shapes a machine can see. Most accidental decisions don't
have a shape: a threshold typed in once, a "temporary" default. Those are
caught by reading the ledger at the Monday review and asking, for each new
one, whether it was meant and whether it's as late as it can be.

## Merged means merged

A commit pushed to a pull request's branch after the PR merges never reaches
main, and nothing says so. It happened twice on Nov 14, 2026 (the fixes meant
for #58 and #59). The weekly site checks (O4) now look for it. Before saying
a PR is ready, check it's still open and its head is the last commit pushed.

## A hard stop over trust

Set Nov 19, 2026. Applies to every tool and agent here, and to Lindsay's other
builds.

Where safety is at stake and it's reasonable to build one, a hard stop goes in
the code instead of trusting a person to remember. That includes the person
building it. A switch, a setting, or a note someone has to read is trust. A
hard stop is something the code refuses to do.

- **Safety means:** anything that could expose people's data, spend past a
  cap, publish something unchecked, or let an agent act outside its job.
- **A hard stop:** the code refuses the input or the action and says why. No
  variable or switch can turn it off. Changing it takes a code change through
  a pull request, where it's seen and recorded.
- **Where reasonable:** if a hard stop would block ordinary use, use the
  strongest guard that doesn't, and mark the choice with a `DECISION(id):`
  comment so it's on the ledger.
- **Already in place:** never-events are code, not trust
  ([new-agent-checklist.md](new-agent-checklist.md)). An agent with no key, or
  a dead one, reports "Didn't run" or "Stopped" and never skips quietly.
- **Next:** the review-queue triage agent gets built to read only its planted
  test file. Pointing it at real submissions waits until someone owns
  security.
