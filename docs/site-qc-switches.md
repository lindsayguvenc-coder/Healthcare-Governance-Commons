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
| `SITE_QC_SKIP` | check ids, comma-separated, e.g. `N3,F3` | Leaves those checks out of every run; the run says they were skipped. Ids are in the Site QC crosswalk Sheet. |
| `SITE_QC_PR` | warn, enforce | PR guards: `warn` shows failures without failing the check; unset or `enforce` fails it. The older drift checks always enforce. |

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
