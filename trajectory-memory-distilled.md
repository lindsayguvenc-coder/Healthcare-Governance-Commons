# Trajectory-Informed Memory Generation for Self-Improving Agent Systems

**Source:** Fang, Isahagian, Jayaram, Kumar, Muthusamy, Oum, Thomas | IBM Research | arXiv: 2603.10600 | Technical Report, 2026  
**Commons relevance:** AI failure mode taxonomy · Audit trails & provenance · Monitoring · Stop mechanisms · Override authority

---

## The Core Problem

LLM-powered agents have amnesia. Every time an agent struggles with an authentication flow, fails to check prerequisites before an action, or uses an inefficient API call pattern, it starts fresh next time — with no memory of what went wrong or what worked. The patterns are there in the execution logs. Nobody is using them.

This paper builds a system that automatically extracts actionable learnings from those logs and injects them into future agent behavior.

---

## The Key Insight: Three Types of Learning Opportunity

Most systems only learn from outright failures — and many don't even do that. This paper identifies **four outcome types** that all contain learnable signal:

- **Clean success** → extract *strategy tips* (what worked, replicate it)
- **Inefficient success** → extract *optimization tips* (it worked, but there was a better way)
- **Failure-then-recovery** → extract *recovery tips* (what went wrong, how it was fixed)
- **Complete failure** → extract *prevention tips* (what decision caused it and when)

The distinction between these is not obvious from raw logs. The agent may fail at step 15 because of a bad assumption made at step 3. The system has to trace causally backward through the reasoning chain to find the actual decision point — not just note the outcome.

---

## How It Works: Three Phases

### Phase 1 — Extract

Four components analyze a completed agent trajectory:

**Trajectory Intelligence Extractor** parses the agent's reasoning into types — analytical thoughts, planning thoughts, validation thoughts, reflection thoughts — and identifies cognitive patterns (did the agent verify prerequisites? did it self-correct? did it assume without checking?). Crucially this is semantic, not keyword-based — "I need to make sure all APIs are included" is recognized as validation behavior even without the word "validate."

**Decision Attribution Analyzer** traces backward from outcomes to find the actual causal decision. Distinguishes immediate cause (what directly triggered the failure), proximate cause (recent decisions that enabled it), and root cause (the underlying assumption or gap). Does this for failures, recoveries, inefficiencies, and successes.

**Contextual Learning Generator** converts the causal analysis into structured, actionable tips with: content, category, concrete implementation steps, trigger condition, and optional negative example ("do NOT do X"). Both domain-specific and generic versions are generated from the same trajectory.

**Subtask Decomposition** breaks trajectories into reusable logical phases — authentication, data retrieval, processing, task completion — so that tips transfer across tasks that share the same subtask even if the overall task is different.

### Phase 2 — Store

Tips are generalized (entity names removed, actions normalized), semantically clustered, deduplicated, and consolidated. Contradictory tips are resolved using outcome metadata — tips from successful trajectories take precedence; proven recovery patterns take precedence over speculative prevention.

Each tip is stored with two representations: a vector embedding for semantic search, and structured metadata (category, priority, application context, source trajectory IDs) for filtering.

### Phase 3 — Retrieve and Inject

When a new task arrives, relevant tips are retrieved and injected into the agent's prompt before it starts reasoning. Two retrieval strategies:

- **Cosine similarity** — fast, no LLM call, pure vector lookup. Best threshold empirically around 0.6.
- **LLM-guided selection** — more expensive, but reasons about task context, prioritizes tip categories, applies metadata filters. Substantially better for cross-variant consistency.

---

## What's New

Previous systems that extract from trajectories had at least one of these gaps:
- Only learned from successful trajectories (missed failures and recoveries)
- No causal attribution (stored outcomes, not decision chains)
- No structured tip categories (free-form text, not retrievable by type)
- No provenance (couldn't trace a tip back to the trajectory that generated it)
- Monolithic outputs (a growing document, not structured retrievable entries)

This paper addresses all five simultaneously. The provenance tracking is particularly notable — every tip maintains a link back to its source trajectory, enabling validation of whether learnings are actually working, debugging of incorrect guidance, and auditing of the system's decisions.

---

## Results

Tested on AppWorld benchmark (realistic multi-app agent tasks — e-commerce, email, calendar, file management).

**Best configuration** (subtask-level tips + LLM-guided retrieval) vs. baseline (no memory), on held-out tasks:

| Metric | Baseline | With Memory | Gain |
|---|---|---|---|
| Task Goal Completion | 69.6% | 73.2% | +3.6 pp |
| Scenario Goal Completion | 50.0% | 64.3% | +14.3 pp |

Scenario Goal Completion requires passing *all variants* of a scenario — it's the stricter metric and the one that matters for reliability. The gains scale dramatically with task complexity:

| Difficulty | SGC Baseline | SGC With Memory | Gain |
|---|---|---|---|
| Easy | 79.0% | 89.5% | +10.5 pp |
| Medium | 56.2% | 56.2% | 0 pp |
| Hard | 19.1% | 47.6% | +28.5 pp (149% relative) |

The hard task improvement is the headline number. Complex multi-step tasks requiring planning, prerequisite management, and error recovery are exactly where learned experience matters most.

---

## Governance Implications for the Commons

### Audit trails and provenance

The paper's provenance requirement — every tip traces back to its source trajectory — is a direct parallel to what the Commons needs from AI governance documentation. The system cannot validate whether a learning is working, debug incorrect guidance, or build trust without that traceability. The same logic applies to governance decisions: an authority matrix entry or stop mechanism threshold needs to trace back to the evidence that generated it, not just exist as a rule.

### What "monitoring" actually means for learning agents

This system is monitoring agent execution trajectories for patterns — not just outcomes. The distinction matters for governance: outcome monitoring (did it succeed or fail?) misses the causal story. A system that succeeded inefficiently, or succeeded by recovering from a failure it shouldn't have encountered, is a different governance signal than a clean success. The Commons monitoring architecture should distinguish these.

### Stop mechanisms and the causality problem

The paper's Decision Attribution Analyzer highlights that the causal decision point is often far upstream of the observable failure. This is directly relevant to stop mechanism design — a stop trigger that fires on observable failure may be too late, or may fire on the wrong signal. The governance implication is that stop mechanisms need to be calibrated against decision patterns, not just output outcomes.

### The OpenClaw connection

Paired with the OpenClaw-RL paper (arXiv: 2603.10165), this paper represents two complementary approaches to the same problem — agents that improve from experience. OpenClaw updates weights continuously from live signals. This paper updates behavior via retrieved memory without touching weights. The governance challenge is different in each case:

- **OpenClaw** (weight updates): the model itself changes — the audit object is a moving target
- **Trajectory memory** (prompt injection): the model is static, but its effective behavior is shaped by an accumulating memory store — the audit object is the memory system and its retrieval logic

Both require governance infrastructure that accounts for non-static behavior. Neither fits cleanly into the "deploy then monitor a fixed thing" model that most current governance frameworks assume.

### Enterprise deployment signal

The paper notes the framework is being applied to IBM's CUGA (Configurable Generalist Agent) enterprise platform. This is not a research demo — it's production infrastructure. The governance questions it raises are not theoretical.

---

## Commons Commentary: Decision Quality ≠ Outcome Quality

*The following observation emerged in review of this paper and is captured here for governance mapping purposes.*

The paper's tip consolidation logic gives precedence to tips from successful trajectories and proven recovery patterns over speculative prevention tips. This is a reasonable engineering default — but it conflates decision quality with outcome quality.

A correct decision can produce a bad outcome (due to noise, incomplete information, or downstream factors outside the agent's control). A flawed decision can produce a good outcome (by luck, or because the error happened to cancel with another error). If tips are weighted by outcome, the memory system systematically learns to replicate the decisions that happened to work — not the decisions that were soundly reasoned.

**The clinical QC parallel:** In CLIA/CAP quality control, a correct result from a flawed process is still a process failure. You don't calibrate your QC thresholds against outcome data alone — you audit the process. A result that happens to be in range when your reagent is degrading is not evidence that your process is working; it's evidence that you got lucky. The QC failure is real even if the patient result was acceptable.

The same structure applies here. Tips derived from trajectories where the agent succeeded through a flawed process — an unnecessary recovery, an inefficient path that worked out — will be labeled as success-derived and given higher precedence in consolidation. The memory system learns the flawed process as if it were sound.

**The governance requirement this creates:** Any tip memory system used in a clinical or governance context needs an explicit layer of process review — not just outcome review — before tips are promoted to high-precedence status. A tip that says "when authentication fails, retry three times before escalating" needs to be evaluated against the process logic, not just against the outcome rate of tasks where it was applied.

**Commons mapping:** This commentary maps to Validation, Stop mechanisms, and Authority nodes. The decision quality / outcome quality distinction is a named limitation of the paper's consolidation logic and a requirement for any governance-grade deployment of trajectory-based memory systems.

---

## Limitations the Authors Name

- Evaluation on one benchmark (AppWorld); generalization to other domains untested
- Potential interference on already-easy tasks — injecting tips when the agent is already performing optimally can slightly degrade performance
- Multi-agent extension (cross-agent attribution, agent-role-aware tips) is future work
- Only tested with GPT-4.1; behavior across model families unknown

---

## Connection to Other Commons Documents

| Commons Node | This Paper's Contribution |
|---|---|
| Audit trails | Provenance tracking from tips to source trajectories is a model for how governance decisions should trace to evidence |
| Monitoring | Distinguishes outcome monitoring from pattern monitoring — the latter is necessary to catch inefficient successes and causal failures |
| Stop mechanisms | Causal attribution shows that the decision point precedes the observable failure — stop triggers need upstream signals, not just output signals |
| Authority | Memory consolidation and conflict resolution (which tip wins when tips contradict?) is an authority problem requiring explicit decision rules |
| Validation | Tips must be validated over time — do similar failures still occur after a learning is deployed? This is an ongoing validation loop, not a one-time check |

---

*Distilled for the Healthcare Governance Commons. Full paper: https://arxiv.org/abs/2603.10600v1*
