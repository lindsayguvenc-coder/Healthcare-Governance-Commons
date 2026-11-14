# Shared setting names

As of 2026-11-14. Generated from the Agent QC settings registry; don't edit by hand.

The Commons tools that ask about QC settings use one name, unit and option list for each.
This is the list, with each tool's own question or key.

| Code | Tool |
|---|---|
| CS | Commons Agent QC Setup |
| VP | Validation Protocol Generator |
| RA | ROI Assessment |
| LV | Local Validation Kit |

## Words

| Use | Instead of | Means |
|---|---|---|
| control | test task (VP) | A fixed input with a known acceptable answer, run on a schedule. |
| run | — | One execution of the agent on one input. |
| block | window (GB, for pass/fail) | A fixed group of runs that pass/fail counts are taken over. |
| window | — | A sliding group of recent runs, for drift sensors only. |
| in control · warn · reject | ok/warn/bad (GB); action-level (VP); Accept/Warn/Reject (lanes) | Run verdicts. A lane's out-of-lane consequence is reject, warn or accept. |
| machine failure | — | A run that failed for machine reasons; kept out of QC. |
| hold · release · re-baseline · withdraw | suspend (VP), sunset/exit (RA) | Queue states and actions. Withdraw = stop using. |
| owner | approver, who sets the lanes | The one role that signs lanes and approves loosening. Releases unless delegated to an operator or an independent authority. |
| harm · cost · little | high/mod/low (keys), Low/Medium/High (GB) | Consequence levels. |
| override | edit rate, undo rate, dismiss rate | Any time a person corrects, edits, redoes or rejects a real output. |
| fully loaded cost | assurance cost (RA) | API spend plus human checking time, per completed task. |
| allowable shift | TEa (GB), % deviation (VP) | How far the mean may move on a version change and still pass. |
| Westgard rule names | 13s, 22s, R4s, 41s, 12s (GB) | 1-3s, 2-2s, R-4s, 4-1s, 10x, 1-2s. |
| Now · Today · This week | 1a/1b/1c | Urgency. |
| operator · owner · independent authority | QC operator, Independent Authority | The three release roles. Solo, all three can be the owner. |
| stop-using point | floor, exit threshold, stop tier | Withdraw below it. Never has a default. |
| baseline | baseline window | Mean and SD (or rate) from the locked baseline runs. |
| lookback | blast-radius review | Review of outputs since the last good QC run, in scope only. |
| version gate | new lot | Old vs. new on the same controls before a new model or prompt is used. |
| fallback | backup, downtime procedure | Where the work goes while the agent is held. |
| bad-input control | bad sample | A control with a broken or corrupted input. |
| auto-release | autoverification | Results go out with no human when nothing tripped. |
| commutability | — | A control has to behave like real work. |
| anchor · drift sensor · near-cutoff | easy / contested / headroom | Control levels: clear cases, contested cases with no key, and cases near a decision point. |
| rerun · verification runs | clean reruns | One documented rerun for suspected random error; verification runs confirm a fix before release. |
| attribute rule | — | For a zero-spread baseline: any anchor change rejects, any contested change warns. |

## Settings

| Id | Name | Unit | Starts at | CS | VP | RA | LV |
|---|---|---|---|---|---|---|---|
| `stakes.domain` | Kind of work | choice: clinical | general | general (MS), clinical (CS) | fixed clinical |  |  |  |
| `stakes.intended_use` | Intended use | text | none (required) | stab.use | q2_usetype + q1 fields |  |  |
| `stakes.consequence` | Consequence if wrong and uncaught | choice: harm | cost | little | set by owner | d.cons, same | q2_usetype (use type, not consequence) | q_use_type |  |
| `stakes.closeness` | How exact the output must be | choice: exact | close | loose | set by owner | d.close |  |  |  |
| `stakes.exposure` | How often something can change underneath | choice: often | some | rare | set by owner | d.exp | q_contract_updates, q_fda PCCP (evidence for it) |  |  |
| `stakes.autonomy` | How much stands between output and the world | choice: informs | recommends (approved each time) | acts unless stopped | acts on its own | set by owner | d.auto (added Nov 14) | q_autonomy | q_agent_actions (agents only) |  |
| `stakes.use_type` | What the output is used for | choice: VP list | set by owner | n/a | q2_usetype (8 options) | q_use_type, VP wording for shared items |  |
| `harness.model` | Model and version | text | recorded every run | h.model (added Nov 14) | q1_version |  |  |
| `harness.prompt` | Prompt | text, fingerprinted | recorded every run | h.prompt (added Nov 14) |  |  |  |
| `harness.tools` | Tools it can call | list | set per agent | h.tools (added Nov 14) | qa_toolcalls (asks if checked, not which) |  |  |
| `harness.actions_allowed` | Actions allowed | list: read | write | send | change, each with needs-confirmation yes/no | none until set | h.actions (added Nov 14) | qa_irreversible, qa_approval, qa_permissions | q_agent_actions |  |
| `metric.output_type` | What one run produces | choice: binary | cat | graded | cont | text | agent | image | none | k1.type |  |  |  |
| `metric.accuracy` | Accuracy metric | index into the metric list for the type | first listed | k1.accuracy |  |  |  |
| `metric.precision` | Precision metric | index | first listed | k1.precision |  |  |  |
| `metric.drift` | Drift metric | index | first listed | k1.drift |  |  |  |
| `baseline.runs` | Baseline runs | runs | 20 | same |  |  | n/a |
| `baseline.established_after` | Runs before a provisional baseline is fixed | runs | 300 pass/fail, 200 sensors (GB) | stab.est = 300 |  |  |  |
| `baseline.excludes_flagged` | Flagged runs never feed the baseline | fixed | always | same |  |  |  |
| `controls.size` | Control set size | controls | 12 | stab.cset | 'test tasks with known correct end states' = controls |  | 'cases' |
| `controls.levels` | Control levels | list | anchors, drift sensors, bad input, near-cutoff | stab.levels |  |  |  |
| `controls.source` | Where controls come from | choice: synthetic | real | mixed | synthetic | stab.src |  |  |  |
| `controls.schedule` | Control run schedule | choice | Daily, and after any change | stab.sched |  |  |  |
| `controls.validated_range` | Validated range | text | The inputs used at validation | stab.range |  |  |  |
| `precision.repeats` | Repeat runs per control | runs | none set | stab.reps = 5 | qa_repeat, qa_repeat_k ('5 runs each') |  |  |
| `precision.agreement_min` | Minimum agreement across repeats | % of repeats | 95 / 90 / 80 by closeness | stab.agree |  |  |  |
| `precision.second_day` | Second-day repeat | choice | before go-live, and after any change | stab.day2 |  |  |  |
| `precision.spread_check` | Spread check | fixed | rolling SD of 20 runs: watch > 1.25×, investigate > 1.5× | stab.sdr |  |  |  |
| `limit.warn_sd` | Warning limit | SD from baseline mean | 2 SD | same | separate: VP asks allowable shift (q22), the report derives SD limits |  |  |
| `limit.reject_sd` | Rejection limit | SD | 3 SD | same | separate: allowable shift reject (q23) |  |  |
| `rules.westgard` | Westgard rules on, warn or reject | per rule: off | warn | reject | 1-2s warn, 1-3s reject, 2-2s reject, R-4s off, 4-1s warn, 10x reject | rules.westgard, saved | report rule tiers now warning / reject (stop only for the stop-using point) |  |  |
| `controls.anchor_change` | When an anchor changes | choice: reject | warn | reject | chg.anchor |  |  |  |
| `rules.zero_spread` | Rule for a zero-spread baseline | fixed | attribute rule | chg.zero |  |  |  |
| `rules.target` | Detection target | text | 1 SD shift caught within 10 runs, under 1 false alarm per 100 runs | chg.target |  |  |  |
| `rules.cusum` | CUSUM | choice: not used | k 0.5 h 4 | k 0.5 h 5 | not used | chg.cusum | named as a drift option in the report |  |  |
| `rules.moving_average` | Moving average | choice: not used | 10 | 20 runs | not used | chg.ma |  |  |  |
| `rules.floor_after_fix` | Multi-run rules don't look back past a fix | fixed | always | chg.refix (fixed) |  |  |  |
| `count.block` | Block size for pass/fail counts | runs | 20 | same |  |  |  |
| `count.false_alarm_warn` | Warning false-alarm target, per block | % of blocks | 5 | c.b_aw |  |  |  |
| `count.false_alarm_reject` | Rejection false-alarm target, per block | % of blocks | 0.3 | c.b_ar |  |  |  |
| `count.baseline_rate` | Baseline failure rate | % | from baseline | same |  |  |  |
| `drift.sensors` | Drift sensors | choice: warn only | not used | warn only | chg.drift |  |  |  |
| `drift.window` | Drift-sensor window | runs, sliding | 10 | c.cs_w |  |  |  |
| `drift.false_alarm` | Drift-sensor false-alarm target | % of windows | 2 | c.cs_aw |  |  |  |
| `allowable.shift` | Allowable shift on a version change | % of baseline mean | 5 / 10 / 20 by closeness (exact / close / loose) | chg.shift = 10 | q22 (warning) and q23 (reject), worded as allowable shift |  |  |
| `allowable.total_error` | Allowable total error | % (numbers) | 10 | c.sg_tea |  |  |  |
| `grade.reject_offset` | Grade rule | grades from expected | reject at ±2, warn at 4 in a row ±1 | same |  |  |  |
| `version.gate` | Version gate | choice | Required before a new model version goes live | chg.gate | q_contract_updates |  |  |
| `version.gate_runs` | Version gate runs, old and new | runs each | 20 | chg.gaten |  |  |  |
| `limit.stop_using` | Stop-using point | % of runs acceptable | none (example 95%) | same | q_floor_sens, q_floor_spec, qa_floor, qs_floor: 'your stop-using point', no default; report's % stop tier removed | q_exit_threshold: 'stop-using point' | target 90% is rule accuracy, not this |
| `lane.scale` | Answer scale | list | example scale | L.scale |  |  |  |
| `lane.ordered` | Answers have an order | yes/no | yes (clinical), no (general) | L.ordered |  |  |  |
| `lane.owner` | Owner (signs lanes, releases, approves loosening) | role | Whoever owns the decision the output feeds | same | q15a_authority (suspension), q19_owner (action plan) |  |  |
| `lane.spec_source` | Where the lanes come from | text | cited spec, else owner's judgment, labeled | ae.spec |  |  |  |
| `lane.controls` | Lanes per control | per control: expected, highest, lowest, slow/fast consequence, also-acceptable | example set | L.ctrls |  |  |  |
| `never_events` | Never-events | list | listed at validation | ae.never |  |  |  |
| `ae.limits_shape` | Acceptance limits shape | choice | Two-sided, asymmetric | ae.lanes |  |  |  |
| `escalation.required` | Required behaviors per control | text | set at validation | same |  |  |  |
| `escalation.absent` | Consequence when a required behavior is absent | choice: reject | warn | reject (safety) | same |  |  |  |
| `escalation.runs` | Runs per required-behavior control | runs | 20 | esc.runs |  |  |  |
| `escalation.over_asking` | Unnecessary asking: upper limit | % of runs | set at validation | esc.over |  |  |  |
| `input.register` | Input register | list | example list | input.reg |  |  |  |
| `input.notify` | Notification source per input | text | named per input | input.notify |  |  |  |
| `input.fingerprint` | Input fingerprint | choice | every run | input.fp, still allows control runs only |  |  |  |
| `input.live` | Live input monitoring | text | prevalence, missing fields, language mix | input.live |  |  |  |
| `injection.controls` | Prompt-injection controls | list, fixed once added | a few distinct styles | input.inj |  |  |  |
| `subgroup.groups` | Groups to report | list | groups recorded reliably | sub.groups | q40_subgroup, q_subgroup | q_equity_populations | groupby |
| `subgroup.min_size` | Minimum group size for a reported rate | cases | 30 | sub.min = 30 |  |  | SET.minGroup = 30; groups under it read 'insufficient data' |
| `subgroup.gap` | Size that matters | × overall error rate | 1.5 | sub.gap |  |  |  |
| `subgroup.cadence` | Subgroup review cadence | choice | Quarterly | same |  |  |  |
| `grader.second_review` | Second review of graded runs | % of graded runs | 20 | same | qs_grader (who judged) |  | SET.secondReview = 0.2 |
| `grader.agreement_min` | Minimum reviewer agreement | Cohen's κ | none set | same |  |  | SET.kappaMin = 0.6; flags below it |
| `realuse.sample` | Real-use sample | outputs per period | 5 per run (GB); 'set in setup' (MD) | stab.real = 5 |  | q_scribe_quality (asks if done) |  |
| `override.tracked` | Override rate tracked | source | every correction, edit, redo or rejection of a real output | esc.ovr | q_override, qs_edit_rate, qa_override | q_override_rate |  |
| `override.warn` | Override rate warning | rule | rising over the period | esc.ovrw |  |  |  |
| `cost.fully_loaded` | Fully loaded cost | $ + minutes per completed task | tracked | ca.cost |  | q_assurance_cost note names it fully loaded cost |  |
| `response.first` | Automatic first response to a rejection | choice | hold and route (harm); warn and log (little) | ca.first |  |  |  |
| `response.cause_classes` | Cause classes | fixed | non-analytic, systematic, random, not found | ca.cause |  |  |  |
| `response.rerun` | Automatic reruns before holding | fixed | one documented rerun, random-error rules only (1-3s, R-4s) | ca.rerun (fixed) | report: one rerun only when random error is suspected |  |  |
| `response.verify_runs` | Verification runs before release | runs, all without rejects | 5 | ca.verify |  |  |  |
| `response.failover` | Fallback when held | choice: previous version | rules-based | human queue | none | human queue | ca.fail | q11_backup, q12, q13 |  |  |
| `response.backup_check` | Fallback check | control runs | 50 | ca.failn |  |  |  |
| `ack.deadline` | Warning acknowledgment deadline | time | by the next periodic review (little); 1 business day (harm) | same |  |  |  |
| `queue.owner` | Human queue owner and response time | role + time | named role; same shift | ca.queue |  |  |  |
| `release.authority` | Who may acknowledge, release and override | per power: role | by consequence (little: owner for all) | same | q15a_authority, q15a_backup_auth |  |  |
| `auto.release` | Auto-release criteria | fixed list | no rejection, no overdue warning, model unchanged, no locked parameter changed | ca.auto |  |  |  |
| `warn.auto_accept` | Auto-accept for warnings | choice | on, once validation is locked | ca.autoacc |  |  |  |
| `lookback.scope` | Lookback scope | text | since last acceptable run, worst first | ca.look |  |  |  |
| `lookback.notify` | Corrected outputs and notification | text | whoever acted on it | ca.corr |  |  |  |
| `contingency.reminders` | Contingency reminders | list of times | 24 h, 72 h, 7 days | same | q15_gap_time = ca.gap |  |  |
| `change.tiers` | Change tiers | fixed | re-baseline by owner; revalidate when use changes | ca.tiers |  |  |  |
| `capa.qc_miss` | When QC misses a failure | fixed | QC design review | ca.capa |  |  |  |
| `report.outward` | Outward reporting | choice | vendor + incident process | ca.out | q45_safety_reporting |  |  |
| `eqa.participation` | External quality assessment | choice | intends to take part | same | q25–q29 (challenge set, peers, registry) |  |  |
| `review.cadence` | Periodic review | choice from the shared list | Quarterly | same | q19_cadence (Weekly / Monthly / Quarterly / Twice yearly / Annually / Not yet defined) |  |  |
| `review.emergency` | Emergency review after a rejection | time | same day (harm) |  | q21_emergency |  |  |
| `plan.revision` | Plan revision | integer | increments on every change | missing |  |  |  |
