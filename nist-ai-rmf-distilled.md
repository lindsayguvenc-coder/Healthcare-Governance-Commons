# NIST AI Risk Management Framework: Core Framework + GenAI Profile

**Sources:**  
- NIST AI 100-1, *Artificial Intelligence Risk Management Framework (AI RMF 1.0)*, January 2023. https://doi.org/10.6028/NIST.AI.100-1  
- NIST AI 600-1, *AI RMF: Generative Artificial Intelligence Profile*, July 2024. https://doi.org/10.6028/NIST.AI.600-1  
**Author:** National Institute of Standards and Technology, U.S. Department of Commerce  
**Commons relevance:** Governance architecture · Authority · Validation · Monitoring · Stop mechanisms · Accountability

---

## What This Is

The NIST AI RMF is the de facto US standard for AI risk management — voluntary, non-sector-specific, and use-case agnostic. It was mandated by the National AI Initiative Act of 2020, developed through 18 months of multistakeholder engagement with 240+ contributing organizations, and is now referenced by multiple federal regulations and used globally as a foundation for AI governance and EU AI Act readiness.

The GenAI Profile (NIST AI 600-1) is a companion resource that extends the core framework specifically to generative AI risks. It was developed via a public working group of 2,500 participants and identifies 12–13 risks novel to or exacerbated by generative AI, with 200+ suggested actions mapped to the four core functions.

Neither document is prescriptive. Both are structured around outcomes, not checklists. The framework is designed to be layered into existing organizational risk management rather than replace it.

---

## Why AI Risk Is Different from Traditional Software Risk

The framework explicitly addresses why standard software risk management is insufficient for AI. Key differences:

Training data that changes over time can alter system behavior in ways that are hard to understand and predict. AI systems trained in one context may be deployed in another — and the developer may have no visibility into how the system is eventually used. Scale and complexity (systems with billions of decision points) make failure mode prediction fundamentally harder than for traditional code. Pre-trained models introduce statistical uncertainty and bias management challenges not present in systems built from scratch. AI systems require more frequent maintenance and monitoring due to data, model, and concept drift. Opacity and limited interpretability make testing and documentation more difficult. Third-party AI components — pre-trained models, foundation models, external data — introduce risks that the deploying organization may not be able to assess.

Healthcare-specific parallel: a clinical AI model can behave exactly as designed while the deployment context has shifted enough to make it clinically invalid. The model's internal behavior hasn't changed; the risk has.

---

## The Seven Trustworthiness Characteristics

The framework organizes AI risk management around seven characteristics that together define trustworthy AI. These are not independent — they interact, create tradeoffs, and must be balanced in context. Valid & Reliable is listed as a necessary condition for all others.

**Valid and Reliable** — the system performs as required, under expected conditions, over time. Accuracy and robustness contribute but can be in tension: a highly robust system may sacrifice accuracy, and vice versa. Validity and reliability must be assessed against realistic test sets representative of deployment conditions, and measurements must include disaggregation across data segments and affected groups.

**Safe** — the system does not, under defined conditions, endanger human life, health, property, or the environment. Safety requires rigorous simulation and in-domain testing, real-time monitoring, and the ability to shut down, modify, or have human intervention when systems deviate from intended functionality. Safety risk management should take cues from transportation and healthcare.

**Secure and Resilient** — the system maintains confidentiality, integrity, and availability; can withstand unexpected adverse events or changes; and can degrade safely when necessary. Common concerns include adversarial examples, data poisoning, and model exfiltration. Resilience is the ability to return to function after adverse events; security includes resilience but also encompasses protocols to prevent attacks in the first place.

**Accountable and Transparent** — transparency reflects the extent to which information about an AI system and its outputs is available to those interacting with it, including those unaware they are doing so. Transparency is a necessary but not sufficient condition for accountability. A transparent system is not automatically accurate, fair, or private — but it is difficult to determine whether an opaque system possesses any of those characteristics, especially as complex systems evolve.

**Explainable and Interpretable** — explainability addresses *how* a decision was made; interpretability addresses *why* it is meaningful in context. Together they allow those operating or overseeing a system to gain deeper insight into its functioning and trustworthiness. Explainable systems can be debugged and monitored more easily and lend themselves to more thorough audit and governance.

**Privacy-Enhanced** — privacy values (anonymity, confidentiality, control) should guide design, development, and deployment choices. Privacy risks can influence security, bias, and transparency and come with tradeoffs with each. Privacy-enhancing techniques can reduce accuracy under data sparsity conditions — a directly relevant tradeoff for clinical AI.

**Fair — with Harmful Bias Managed** — the framework identifies three categories of AI bias: systemic (present in datasets, organizational norms, and broader society), computational and statistical (often from non-representative samples), and human-cognitive (how individuals perceive AI outputs and fill in missing information). Each can occur without prejudice or discriminatory intent. Mitigating bias does not guarantee fairness — a system balanced across demographic groups may still be inaccessible or exacerbate other disparities.

---

## The Four Core Functions

The framework organizes risk management activity into four functions: GOVERN, MAP, MEASURE, and MANAGE. GOVERN is cross-cutting and infuses the other three. The functions are iterative and should be applied continuously across the AI lifecycle, not as a one-time deployment checklist.

### GOVERN
Establishes the organizational culture, structure, policies, and accountability mechanisms for AI risk management. Without GOVERN, the other three functions lack authority, resources, and continuity. Key outcomes include: legal and regulatory requirements documented; trustworthiness characteristics integrated into organizational policy; risk tolerance defined and documented; roles and responsibilities assigned; decommissioning processes established; third-party risk addressed. GOVERN requires executive leadership accountability — not delegated to technical teams alone.

### MAP
Establishes the context for understanding what risks a specific AI system poses. This is where intended purpose, potential impacts, system categorization, user context, and risk tolerance are documented before measurement begins. MAP produces the information that MEASURE and MANAGE depend on. Without MAP, risk measurement is performed without context and produces results that may not reflect actual deployment risk. MAP should be revisited as context, capabilities, and impacts evolve.

Key MAP outcome: an initial go/no-go decision about whether to design, develop, or deploy a system at all. This is a named governance checkpoint, not an implicit assumption.

### MEASURE
Employs quantitative, qualitative, or mixed-method tools to analyze, assess, benchmark, and monitor AI risk. Uses what MAP identified; informs what MANAGE responds to. AI systems should be tested before deployment and regularly while in operation. Key principles: independent assessment (internal reviewers who did not serve as front-line developers, or external assessors); rigorous documentation of test sets, metrics, tools, and uncertainty; regular monitoring of deployed system behavior; feedback mechanisms for end users and impacted communities to report problems.

MEASURE categories cover: appropriate method selection; trustworthiness characteristic evaluation across all seven dimensions; mechanisms for tracking risks over time including emergent and unanticipated risks; and feedback loops to assess whether measurement approaches are actually working.

Critically: risks that cannot be measured must still be documented. The inability to measure a risk does not mean the risk is low — it means the governance framework must account for the uncertainty explicitly.

### MANAGE
Allocates risk resources based on what MAP and MEASURE have produced. Includes plans to respond, recover, and communicate about incidents. Key outcomes: go/no-go deployment determination; risk response plans for high-priority risks (mitigation, transfer, avoidance, or acceptance); documentation of residual risks to downstream acquirers and end users; mechanisms to deactivate or supersede systems that demonstrate performance inconsistent with intended use; post-deployment monitoring plans including appeal, override, and incident response.

MANAGE 2.4 is the stop mechanism subcategory: mechanisms must be in place and applied, with responsibilities assigned, to supersede, disengage, or deactivate AI systems that demonstrate performance or outcomes inconsistent with intended use.

---

## Key Architecture Principles

**Risk is contextual, not categorical.** The framework explicitly does not prescribe risk tolerance. Risk tolerance depends on organizational priorities, sector, application, legal context, and community impact — and changes over time. The framework provides structure for defining and applying tolerance, not the tolerance itself.

**Residual risk must be documented.** Risk remaining after treatment directly impacts end users and affected communities. It must be documented and communicated to downstream acquirers, not absorbed silently.

**All AI actors share responsibility.** The framework distinguishes designers, developers, deployers, operators, evaluators, and affected communities — and emphasizes that risk management responsibility is distributed across all of them, not concentrated in technical teams. The decision to commission or deploy a system is a joint responsibility based on contextual assessment of trustworthiness characteristics.

**Diverse teams improve risk identification.** Demographically and disciplinarily diverse teams produce more open sharing of assumptions about purposes and functions of technology, making implicit assumptions explicit and creating opportunities to surface risks that homogeneous teams miss.

**Human oversight must be meaningful, not token.** GDPR Article 22 (referenced in the GenAI Profile context) clarifies that human oversight of automated decisions must be carried out by someone with authority and competence to change the decision who considers all relevant data. Routinely applying automatically generated profiles without actual influence on the result does not qualify.

---

## GenAI Profile: Risks Novel to or Exacerbated by Generative AI

The GenAI Profile (AI 600-1) identifies risks that either do not exist in traditional AI or are qualitatively different in generative AI contexts. The 12–13 named risks include:

**CBRN (Chemical, Biological, Radiological, Nuclear) information uplift** — generative AI may lower barriers for accessing harmful information, though current evidence suggests existing LLMs may not dramatically increase operational risk beyond traditional search for most CBRN applications. Specialized biological design tools (protein design, novel agent generation) present a distinct and more serious concern.

**Confabulation** — the generation of plausible but incorrect or fabricated content, including citations, data, and factual claims. Confabulation is not an inherent flaw of language models but a result of how they generate outputs — meaning it is a manageable risk, not an inherent property.

**Data privacy violations** — generative AI systems trained on large datasets may inadvertently memorize and reproduce private information. Enhanced data aggregation capability for AI systems is explicitly listed as a risk that traditional software frameworks do not address.

**Homogenization** — similar AI systems deployed at scale may reduce the diversity of outputs, perspectives, and information available across society. This is a systemic risk rather than an individual failure mode.

**Human-AI configuration failures** — automation bias (the tendency to defer to system outputs without meaningful review), and automation complacency, are explicitly named. Under certain conditions, human-AI interaction amplifies human biases rather than correcting them.

**Intellectual property and copyright** — training data may include copyrighted content; training data provenance should be documented and maintained.

**Obscene and harmful content generation** — including deepfakes of real individuals and toxic or stereotyping content.

**Cybersecurity risks** — GAI systems present both offensive (lowering barriers for malware, phishing, vulnerability exploitation) and defensive capabilities. The attack surface of AI systems is complex and not adequately addressed by pre-existing cybersecurity frameworks.

**Societal and environmental impacts** — computational costs of AI model training and deployment, and downstream effects on employment, civil liberties, and democratic institutions.

---

## Governance Commons Relevance

### Authority Node
The framework's distinction between AI actors — designers, developers, deployers, operators, evaluators — maps directly to the Commons' authority allocation architecture. The framework is explicit that responsibility is distributed, not concentrated, and that the go/no-go deployment decision is a named governance checkpoint requiring contextual assessment, not a technical default. Who has authority to make that decision, at what stage, and based on what evidence needs to be explicitly specified in any governance framework.

### Stop Mechanisms
MANAGE 2.4 is the framework's stop mechanism subcategory — mechanisms must be in place, applied, and with responsibilities assigned to deactivate AI systems performing inconsistently with intended use. The framework also specifies that when AI systems present unacceptable negative risk levels, "development and deployment should cease in a safe manner until risks can be sufficiently managed." This is a named requirement, not an implied default. Healthcare AI governance frameworks must name who holds the authority to invoke this mechanism and under what conditions.

### Monitoring Node
The MEASURE function's structure provides the monitoring architecture foundation. The key governance design principle: risks that cannot be measured must be documented explicitly — the inability to measure does not imply low risk. This directly addresses the clinical AI monitoring gap where aggregate performance metrics mask subgroup failures. MEASURE 3.3 specifies that feedback processes for end users and impacted communities to report problems and appeal system outcomes must be established and integrated into evaluation metrics.

### Validation Node
The MAP function's go/no-go checkpoint is a pre-deployment validation gate. The framework's emphasis on realistic test sets, disaggregated measurements, and independent review (internal or external assessors not involved in front-line development) maps directly to the validation requirements for clinical AI deployment. MEASURE 2.5 specifically requires that limitations of generalizability beyond development conditions be documented — the governance analog to the reference range problem in clinical laboratory medicine.

### Accountability
The framework explicitly states that residual risk must be documented and communicated to downstream acquirers and end users. This has direct implications for health system AI governance: a clinical AI tool purchased from a vendor carries residual risks that the vendor must disclose and the health system must accept or mitigate. Treating AI risks in isolation, or assuming that vendor conformity claims transfer accountability, is explicitly against the framework's intent.

---

## Commons Commentary: The Measurement Gap Problem

The framework makes a candid admission that cuts to the core of current clinical AI governance: "The current lack of consensus on robust and verifiable measurement methods for risk and trustworthiness, and applicability to different AI use cases, is an AI risk measurement challenge."

This is not a peripheral observation — it is the central challenge. A governance framework built on measurement assumes that what needs to be measured can be measured reliably. In clinical AI, many of the most important dimensions of trustworthiness — bias in deployment conditions, long-term outcome effects, population-level fairness across subgroups — are exactly the dimensions where robust measurement methods are least developed.

The governance response to this gap cannot be to assume measurement will be available before deployment. The framework's own guidance is clear: risks that cannot be measured must be documented, and the framework should not be applied as if measurement solves governance when measurement itself is uncertain. This means:

Clinical AI governance frameworks must include an explicit category of *governance decisions made under measurement uncertainty* — not just decisions made on the basis of measurement — with higher human oversight requirements and more conservative stop mechanism thresholds when the relevant trustworthiness characteristics cannot be reliably measured.

The Hot Mess paper (Hägele et al., ICLR 2026) provides the empirical backing for why this matters: AI failures on complex tasks are variance-dominated, not systematic — they are harder to characterize and anticipate than traditional measurement frameworks assume. A MEASURE architecture built for systematic failures will miss incoherent ones. The NIST framework's acknowledgment of measurement uncertainty is the governance acknowledgment of the same problem.

**Commons mapping:** This commentary maps to the Validation, Monitoring, and Stop mechanism nodes. It argues for a named governance category of decisions under measurement uncertainty, with specified oversight requirements distinct from decisions supported by validated measurement.

---

## Cross-References to Commons Argument Stack

| Paper | Connection |
|-------|-----------|
| Brundage et al. (2026) | The AI RMF's MEASURE function defines what organizational-level auditing is trying to evaluate. Brundage's AAL tiers map to the framework's tiered depth of measurement — AAL-1 corresponds roughly to MEASURE 1 (methods selection), AAL-2 to MEASURE 2-3 (full trustworthiness evaluation and tracking), AAL-3/4 to independent verification of MANAGE and GOVERN structures. |
| Hot Mess (Hägele et al., 2026) | MEASURE 3.2 explicitly notes that risk tracking approaches are needed for settings where risks are difficult to assess using currently available measurement techniques. The Hot Mess finding that complex AI failures are variance-dominated is the empirical basis for why MEASURE 3.2 cannot remain aspirational. |
| Smuha Ch. 19 (Cambridge Handbook) | The AI RMF's GOVERN function requirements — executive accountability, decommissioning processes, third-party risk governance — are the institutional structures whose absence produced every case study failure Smuha documents. The Dutch, French, UK, and Idaho failures all represent GOVERN function collapses: no risk tolerance defined, no accountability assigned, no stop mechanism specified. |
| Collective Intelligence (Dorn, 2026) | GOVERN 3.1 requires diverse teams for risk management decisions; MAP 5.2 requires regular engagement with relevant AI actors and feedback integration. The Commons' collective intelligence argument is the positive case for why these GOVERN and MAP requirements should be substantive rather than nominal. |
| IBM Trajectory Memory (2025) | MANAGE 4.1 requires post-deployment monitoring plans including mechanisms for capturing user input, appeal and override, and change management. The IBM paper's provenance tracking requirement is the technical implementation of what MANAGE 4.1 requires at the governance level: decisions must be traceable to the evidence that generated them. |

---

*Distilled for the Healthcare Governance Commons.*  
*AI RMF 1.0: https://doi.org/10.6028/NIST.AI.100-1 (public domain)*  
*GenAI Profile: https://doi.org/10.6028/NIST.AI.600-1 (public domain)*
