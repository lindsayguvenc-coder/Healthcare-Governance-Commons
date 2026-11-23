# Site QC: the off switch, graded

Everything is set from your phone, no pull request needed: GitHub, the
Commons repo, **Settings → Secrets and variables → Actions → Variables tab →
New repository variable** (or tap an existing one to change it).

## The levels, from hardest stop to fully on

| Level | How | What happens |
|---|---|---|
| **Hard stop** | Actions tab → pick the workflow → **⋯ → Disable workflow** | GitHub doesn't start it at all. Undo with **Enable workflow**. |
| **Off** | `SITE_QC_MODE` = `off` (or not set at all) | The scheduled run starts, sees the switch, and stops. Nothing is checked. |
| **Quiet** | `SITE_QC_MODE` = `quiet` | Every check runs and the log is kept. Results show on the run's own page in the Actions tab. No issue, no email, and the run doesn't go red. For burn-in. |
| **On** | `SITE_QC_MODE` = `on` | Failures open or update one GitHub issue per workflow, which emails you. It closes itself when a run passes. |

## Finer controls

| Variable | Values | Does |
|---|---|---|
| `SITE_QC_DAILY` | off, quiet, on | Overrides `SITE_QC_MODE` for the daily site health check only. |
| `SITE_QC_WEEKLY` | off, quiet, on | Overrides it for the Monday weekly checks only. |
| `SITE_QC_AGENTS` | off, quiet, on | Overrides it for the AI agents only (C3, C4, S2, C5, C6, C7: `.github/workflows/site-agents.yml`). These spend money, so they get their own switch. |
| `SITE_QC_AGENT_MODEL` | a model id | The model the agents use. Unset: claude-sonnet-5-5, the same as the site's tools. |
| `SITE_QC_SKIP` | check ids, comma-separated, e.g. `N3,F3` | Leaves those checks out of every run; the run says they were skipped. Ids are in the Site QC crosswalk Sheet. Agents too: `C3`, `C4`, `S2`, `C5`, `C6`, `C7`. |
| `SITE_QC_C5_BLOCK` | a number | How many library entries C5 checks for newer versions each week (drafts and recurring reports always, then a rotating slice). Unset: 20. Every page still gets all three move checks every week (layer 1 baseline compare, layer 2 AI reader, layer 3 word pattern), and any page they flag goes to the front of the block. |
| `SITE_QC_C5_TOP_CHARS` | a number | C5 layer 1 (baseline compare): how many characters at the top of each page count. A new or changed word there is flagged. Unset: 600. **To loosen** if it flags too often, lower it (the very top, where banners go). Lowering it is safe any time; raising it can flag extra changes for one run, until the next baseline is saved. |
| `SITE_QC_C5_TOP_IGNORE` | a pattern (regex) | C5 layer 1: each run of new or gone words is checked against it, and a match is ignored. E.g. `^(\w+ )?\d{1,2},?( \d{4})?$` ignores a changed date ("Nov 25," for "Nov 18,") and nothing else. Unset: nothing ignored. The other way to loosen it. |
| `SITE_QC_C5_READER_CHARS` | a number | C5 layer 2 (the closed-book AI reader): how much of each page's top it reads. Unset: 2500 (about $0.15 a week for ~58 pages). |
| `SITE_QC_PR` | warn, enforce | PR guards: `warn` shows failures without failing the check; unset or `enforce` fails it. The older drift checks always enforce. |

## The AI agents' key

The agents use their own key, the `SITE_QC_ANTHROPIC_KEY` **secret** (Secrets
tab, not Variables), separate from the site's key in Vercel. With no key, an
expired key, or an account out of credit, every agent that needed it reports
"Didn't run" or "Stopped" with the reason. It never skips quietly.

Is the key ready before a real run? Actions → Site QC agents → Run workflow,
set **key check only** to `yes`. It does the free key check, then one 1-token
message on Haiku (a tiny fraction of a cent) to prove the account has credit
and the key is under its cap. Nothing else runs and nothing opens. The run goes
red if the key isn't ready, even in quiet mode, and says why on its page.

Test runs with no key and no spend: Actions → Site QC agents → Run workflow,
set **fake** to `good` (every agent does its job) or `misses` (every agent is
broken, so every planted test must show up as missed). Fake runs never open an
issue or a pull request. For C3's pull requests, turn on Settings → Actions →
General → **Allow GitHub Actions to create and approve pull requests**.

Not covered by these switches, on purpose: the weekly backup (it was running
before Site QC and stays on), and the drift checks on every pull request.

## Suggested turn-on

1. Set `SITE_QC_MODE` = `quiet`. Re-enable the two workflows if they're
   disabled (Actions → each workflow → Enable).
2. For a week, read the run pages instead of email. Skip anything noisy with
   `SITE_QC_SKIP` while you sort it out.
3. When the quiet runs look right, set `SITE_QC_MODE` = `on`. Turn up one
   workflow at a time with `SITE_QC_DAILY` or `SITE_QC_WEEKLY` if you'd rather.

GitHub can also email you when a scheduled run fails, separately from these
issues. In quiet mode runs never go red, so that can't happen. Your own
notification settings for that: github.com → Settings → Notifications → Actions.
