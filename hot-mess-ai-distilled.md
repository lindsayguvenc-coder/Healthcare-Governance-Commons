# The Hot Mess of AI: How Does Misalignment Scale With Model Intelligence and Task Complexity?

**Source:** Hägele, Gema, Sleight, Perez, Sohl-Dickstein et al. | Published at ICLR 2026 | arXiv: 2601.23045  
**Affiliation:** Anthropic Fellows Program, EPFL, University of Edinburgh, Constellation, Anthropic  
**Commons relevance:** AI failure mode taxonomy · Stop/monitor threshold design · Audit scope · Override authority

---

## The Core Question

When an AI system does something unintended, is the failure **systematic** (consistent pursuit of a wrong goal) or **incoherent** (random, unpredictable, not furthering any goal)? This distinction has significant implications for how we govern and audit AI.

The paper operationalizes this using a **bias-variance decomposition** of AI errors:

> ERROR = BIAS² + VARIANCE

**Incoherence** is defined as the fraction of total error attributable to variance — how much of the failure is unpredictable rather than consistent.

- **Incoherence = 0:** Every error is consistent; the model reliably pursues the wrong thing (systematic misalignment)  
- **Incoherence = 1:** Every error is random; failures don't correspond to any stable goal (hot mess)

---

## Key Findings

### 1. Longer reasoning → more incoherence (robust finding)

Across all tasks and all frontier models tested (Claude Sonnet 4, o3-mini, o4-mini, Qwen3), the longer a model spends reasoning or taking actions, the more incoherent its failures become. This was observed in:

- Multiple-choice scientific benchmarks (GPQA, MMLU)
- Agentic coding (SWE-Bench)
- Safety/alignment evaluations (Model-Written Evals)
- Synthetic optimization tasks

This is the most consistent finding in the paper. The relationship holds even when controlling for task difficulty — models that naturally generate longer reasoning chains for the same question show higher incoherence than those that generate shorter ones.

### 2. Larger models are more incoherent on hard tasks

Model scale does not uniformly reduce incoherence:

- **Easy tasks:** Larger models become *more* coherent with scale
- **Hard tasks:** Larger models become *more* incoherent with scale

The mechanism: bias (systematic error) decreases faster with scale than variance (random error). On hard tasks, variance becomes the limiting factor. This means scale alone is unlikely to eliminate incoherent failure.

This pattern held across Qwen3, Gemma3, and Llama3 model families.

### 3. The failure mode is "industrial accident," not "rogue optimizer"

The paper's central implication: as capable AI systems tackle harder tasks requiring longer reasoning chains, failures are more likely to resemble **industrial accidents** (unpredictable, hard to anticipate) than **coherent misalignment** (consistent pursuit of a wrong goal).

This reframes the dominant AI risk narrative. The concern about a superintelligent agent coherently pursuing a misaligned goal becomes *less* likely relative to concerns about unpredictable, variance-dominated failures at scale.

### 4. Ensembling reduces incoherence; reasoning budgets help less than expected

- **Ensembling** (averaging multiple outputs) reduces variance at rate 1/E (ensemble size) — but is impractical for real-world action loops where state can't be reset
- **Larger reasoning budgets** modestly reduce incoherence, but natural variation in reasoning length has a much stronger effect — when models naturally think longer about a question, incoherence rises sharply regardless of budget setting

### 5. Incoherence scales with intelligence across domains

A survey study found that humans judge more intelligent entities — AI models, non-human animals, and human organizations — to be *more* incoherent. This mirrors the hot mess theory: as entities become more capable, their behavior becomes harder to explain through a single goal.

---

## Methods

**Tasks tested:** GPQA (scientific reasoning), MMLU (general knowledge), SWE-Bench (agentic coding), Model-Written Evals (safety/alignment), synthetic optimization (transformers as optimizers)

**Models tested:** Claude Sonnet 4, Claude Opus 4, o3-mini, o3, o4-mini, Qwen3 family (1.7B–32B)

**Measurement:** 30 samples per question, bias-variance decomposition using KL divergence and Brier score formulations

---

## Governance Implications for the Commons

### Stop mechanisms and monitoring thresholds

The finding that incoherence increases with task complexity has direct implications for stop/monitor design. A model's failure mode changes character as task scope expands — routine monitoring metrics tuned to detect systematic drift may miss variance-dominated failures entirely. Stop mechanisms need to be calibrated for **unpredictability**, not just directional drift.

### Escalation tier design

If variance dominates on hard tasks, then harder/higher-stakes tasks require more conservative escalation thresholds — not because the model is more likely to be wrong, but because its errors are less predictable and harder to detect or correct.

### Audit scope

The paper distinguishes **bias** (average behavior, auditable against a target) from **variance** (unpredictable behavior, harder to audit with standard evaluations). This maps to a key gap in current AI audit frameworks: most audits measure whether a model behaves correctly on average; they do not measure whether its failures are coherent enough to be characterized or anticipated. Auditing for incoherence requires repeated sampling across diverse conditions, not single-point evaluation.

### Override and human-in-the-loop design

Incoherence is worse precisely when humans are most likely to defer — on complex, long-horizon tasks where AI reasoning is opaque. This is the override boundary problem: the harder the task, the less coherent the failure mode, and the harder it is for a human reviewer to recognize that override is warranted. Override protocol design needs to account for the correlation between task complexity and failure unpredictability.

### Reward misspecification warning

The authors note that their tasks had well-specified objectives. In settings with **poorly specified training objectives**, both bias and variance from the model's "true" behavior would decrease with scale, leaving reward misspecification (goal mismatch baked in at training time) as the dominant risk. This makes goal specification auditing — ensuring the training objective actually matched the intended objective — increasingly important as models scale.

---

## Limitations the Authors Name

- Incoherence metric requires well-defined targets (works for multiple-choice, coding, objective functions; harder to apply to open-ended tasks)
- They do not theoretically explain the mechanism, only document the empirical pattern
- Ensembling results are for GPQA only with o4-mini; broader validation pending
- The survey study on intelligence/incoherence is small (15 subjects) and qualitative

---

## Connection to Other Commons Documents

| Commons Node | This Paper's Contribution |
|---|---|
| Stop mechanisms | Incoherence increases at high task complexity — stop triggers should account for variance, not just directional drift |
| Monitoring | Rolling performance metrics may underdetect variance-dominated failures |
| Audit (AAL-2+) | Audits need repeated sampling across conditions to characterize failure mode, not just average accuracy |
| Override | Task complexity correlates with incoherence — harder tasks need tighter override thresholds, not looser ones |
| Authority / validation | Reward misspecification becomes the residual risk at scale; goal specification validation belongs pre-deploy |

---

*Distilled for the Healthcare Governance Commons. Full paper: https://arxiv.org/abs/2601.23045v1*
