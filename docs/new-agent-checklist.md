# Adding a Site QC agent: checklist

For any new AI agent in `scripts/site-agents.mjs` (or a new lane of one).
Copy the list into the pull request and tick it off. An agent isn't done
until every line is ticked or marked "n/a" with the reason.

## Its rules
- [ ] **One job, one data file.** Name the data file it watches and its source
      rule. If the job needs a looser source rule than an existing agent has,
      it's a new agent, not a new lane of that one.
- [ ] **The checker is never the writer.** It reports or proposes; a person
      edits the data. Say which in the header comment.
- [ ] **Never-events are code, not trust.** A finding with no source fails;
      a source outside its rule warns. Add a plain code backstop beside the
      AI wherever plain words can catch the thing.

## The script (`scripts/site-agents.mjs`)
- [ ] Header comment: id, name, how often, what it does, what it never does.
- [ ] `NAMES`, the default `--only` list, and the `agents` table.
- [ ] Its system prompt carries `RESEARCH_RULES` (and its own source rule).
- [ ] A report in `qc-out/<name>.md` that says the agent proposes, what to do
      with it, and "don't trust this report" when its planted test was missed.
- [ ] The "N … to review" result line (the workflow reads it to open a PR).
- [ ] Measures with the same names the Agent Fleet QC page's template uses
      (Planted items found, Findings with a real source, Sources read per question).

## Its tests (`tests/site-qc/agents/`)
- [ ] **Planted test** in `planted.json`, made up on purpose, with a token
      (`QC-<id>-0001`). It must catch the planted problem, and where false
      alarms matter, leave a planted clean item alone.
- [ ] Backstop controls: it flags the planted item and leaves a clean one alone.
- [ ] Replies in `fake-good.json` (does its job) and `fake-misses.json`
      (broken: every planted test missed, every never-event present).
- [ ] `run-fake.mjs`: good-reply checks, broken-agent checks, the agent in the
      key-problem loop and the SITE_QC_SKIP test, and the control count.
- [ ] `node tests/site-qc/agents/run-fake.mjs` passes
      (`CHROME=/usr/bin/google-chrome`, playwright in tests/replay).
- [ ] Anything that talks to the outside world (page reads, downloads) tested
      once over real HTTP against a local server.

## The workflow (`.github/workflows/site-agents.yml`)
- [ ] Header comment, the schedule (`WHICH`), and the dispatch input's list.
- [ ] Its report in the run-page summary loop.
- [ ] If it proposes: a line in the "Findings as pull requests" step, with its
      own branch folder.
- [ ] The timeout still fits the longest scheduled run.

## The docs
- [ ] `docs/site-qc-switches.md`: the agent in the SITE_QC_AGENTS and
      SITE_QC_SKIP lists, and any new variable.
- [ ] `docs/ROADMAP.md`: what it is, its planted test, what's left.
- [ ] The rules doc for its data file points to the agent.
- [ ] **Site QC crosswalk Sheet:** a row (id, area, what it catches, how often,
      run by, status, seeded control, batch).
- [ ] **Agent Fleet QC page:** the agent added, so Import runs takes its CSV rows.

## Before it counts
- [ ] Spend: how many calls and searches it adds per run, checked against the
      temporary key's cap.
- [ ] A real run with the temporary, spend-capped key; read its report.
- [ ] A week in quiet mode before on.
- [ ] Then the permanent key.
