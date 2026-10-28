# Algorithmic Systems in Public Administrations: Practices, Challenges and Governance Frameworks

**Source:** Nathalie A. Smuha, Chapter 19 in *The Cambridge Handbook of the Law, Ethics and Policy of Artificial Intelligence* (Cambridge University Press, 2025), ed. Nathalie A. Smuha. DOI: 10.1017/9781009367783  
**Author:** KU Leuven Faculty of Law and Criminology; also author of *Algorithmic Rule by Law* (Cambridge University Press, 2025)  
**Commons relevance:** Authority · Stop mechanisms · Accountability · Monitoring · Governance failure taxonomy

---

## Core Argument

Algorithmic regulation in the public sector is not new — public administrations have been automating decision-making since the 1980s. What is new is the scale, sophistication, and consequential stakes of current deployments. The chapter does two things: it catalogs how algorithmic systems actually fail in public governance through case studies, and it maps the existing legal frameworks (constitutional, administrative, data protection, and AI-specific law) that are supposed to constrain those failures — and explains why each is currently insufficient.

The central concept is **"algorithmic rule by law"**: using algorithmic systems to implement problematic policies at scale in ways that are harder to contest, challenge, or reverse than text-based law. This is distinct from technical failure — it is a governance failure that algorithmic systems make structurally more dangerous by automating it at speed.

---

## Governance Failure Case Studies

These four cases share a common pattern: efficiency was the stated goal, scale was the mechanism, and harm was the result — often irreversible by the time it became visible.

### Netherlands — Childcare Benefits Scandal
The Dutch tax authority deployed an algorithmic fraud detection system for childcare benefit recipients. Due to harsh legal rules, even a *suspicion* of fraud (not a finding) triggered full retroactive recovery of all benefits received. The algorithm flagged recipients using discriminatory risk indicators — people with dual nationality and single mothers were systematically more likely to be identified as potential fraudsters. The system violated privacy legislation and used biased parameters. Thousands of families accumulated debts they could not repay; the scandal caused depressions, suicides, and in some cases children were removed into foster care. The Dutch government was forced to resign in 2021. By the time the breach was established, the damage was largely irreparable.

**Governance lesson:** Discriminatory parameters were embedded during development. The system scaled a flawed and harmful policy before oversight mechanisms could detect it. Speed and scale converted a policy problem into a humanitarian catastrophe.

### France — Tax Evasion AI (Swimming Pools)
Nine French regions trialed an AI application (developed by Capgemini and Google, costing ~€26 million) that analyzed aerial images to identify undeclared swimming pools for tax purposes. Over 120,000 undeclared pools were identified by 2024. However: the system has a reported 30% margin of error, mistaking solar panels for pools and missing structures hidden by trees or shadows. A 2023 report by France's Court of Audit found the application constituted unequal treatment — it was deployed only in mainland France, not overseas territories or Corsica, subjecting different citizens to different levels of scrutiny. The same report questioned whether automated tax evasion detection methods produce sufficient evidence of effectiveness at all.

**Governance lesson:** Efficiency gains were real but accompanied by structural inequality in who was subjected to the system, material error rates with no clear correction mechanism, and insufficient evidence that the system actually worked as claimed.

### United Kingdom — A-Level Grade Allocation
During COVID-19, UK authorities deployed an algorithmic system to allocate A-level grades after exams were canceled. The system weighted teacher predictions against historical school-level grade distributions. Nearly 40% of students received lower grades than anticipated. Students in schools with historically lower performance were penalized. Private school students were systematically advantaged — smaller class sizes in specialist subjects meant their teacher estimates (which the government acknowledged were likely inflated) received more weight. The system was publicly scrutinized, widely criticized as discriminatory, and ultimately reversed.

**Governance lesson:** Seemingly neutral technical design choices (how to weight different inputs) encode normative judgments about fairness. When those judgments are embedded in code rather than made explicitly by accountable officials, they become harder to challenge and correct.

### United States — Idaho Medicaid Disability Benefits
Idaho deployed an algorithmic system in 2011 to calculate personalized benefit budgets for people with disabilities under Medicaid. The system had multiple flaws: people who developed more substantial needs saw their budgets contradictorily *decrease*, without explanation. Highly vulnerable individuals were wrongfully denied care they depended on. Similar systems in other states resulted in deaths. After individuals forced a class action before Idaho's District Court, the court found the tool's use amounted to a breach of due process rights and was unconstitutional — tied to the system's lack of transparency and absence of model and data validation.

**Governance lesson:** When an automated system makes consequential decisions about vulnerable people without transparency or meaningful review, the only recourse may be litigation — years after harm has occurred. Due process is not a technicality; it is a governance requirement that algorithmic systems must be designed to satisfy from the start.

---

## Four Structural Challenges

### 1. Impact on Fundamental Rights
Algorithmic regulation requires high-volume personal data processing, which can have vastly intrusive effects. The scale that makes algorithmic systems efficient also makes their rights violations worse: a biased or flawed system affects not one person but thousands simultaneously, at speed, in ways that are harder to discover due to opacity. Privacy, non-discrimination, and human dignity are all at stake — and privacy is often instrumental to securing other rights such as free speech and human dignity.

### 2. Eroding the Rule of Law — "Algorithmic Rule by Law"
Implementing text-based law through algorithmic code requires a translation process. Laws are inherently open to interpretation — that openness is part of how they protect people, by enabling tailored application to specific circumstances. Once automated, that openness closes: a particular interpretation must be codified. The translation may embed biases, deviate from legislative intent, concentrate executive power, undermine predictability, or make it impossible for individuals to contest the chosen interpretation. This is **algorithmic rule by law** — not rule of law, but the use of algorithmic efficiency as a tool to enforce problematic policy at a scale that makes it nearly unchallengeable.

### 3. Diffuse and Delegated Responsibility
When algorithmic systems suggest decisions, civil servants are strongly incentivized to follow them — deviating requires justification, time, and space for critical judgment that organizational culture may not support. The distance between official and citizen reduces the human impulse to take responsibility. Officials may feel they can delegate or share responsibility for a decision with the system — which diminishes procedural legitimacy and increases the likelihood of negligence. The system makes it easier to treat a person as a number and easier to overlook consequences.

### 4. Transfer of Public Power to Private Actors
Discretion does not disappear when algorithmic regulation is deployed — it shifts from individual civil servants to the designers and developers of the systems. These are typically not civil servants with expertise in how the law should be applied or accountability to public values. They are data scientists and engineers at private companies, driven by non-public objectives. The less in-house technical capacity a public administration has, the more dependent it becomes on private actors whose values and incentives diverge from the public interest. This creates a structural conflict: public administrations are obligated to protect human rights and democracy, but the tools implementing their decisions are shaped by actors not bound by those obligations.

---

## Existing Governance Frameworks — and Their Limits

### Constitutional and Administrative Law
Administrative law principles — lawfulness, equality, impartiality, proportionality, participation, transparency — all apply to algorithmic systems. Public administrations cannot escape these obligations by procuring privately developed tools; they remain responsible. However, enforcement is harder in algorithmic contexts because civil servants may lack the technical knowledge to recognize violations, and because the opacity of algorithmic systems makes it difficult to identify when these principles have been breached.

### Data Protection Law (GDPR)
The GDPR imposes obligations directly relevant to algorithmic regulation: lawful basis requirements, data minimization, transparency, accuracy, and the right under Article 22 not to be subject to decisions based solely on automated processing when they produce legal effects. The Article 22 standard requires "meaningful" human oversight — not token gesture. Civil servants who review automated decisions must have the authority and competence to change them and must consider all relevant data. However, determining how much human intervention is sufficient to qualify remains contested and unresolved.

### The EU AI Act — Coverage and Gaps
The AI Act applies a risk-based framework. Many public sector algorithmic applications fall under Annex III (high-risk systems), including systems that evaluate eligibility for healthcare services and social benefits. High-risk systems must undergo risk management processes, log events, maintain technical documentation, and be designed for human oversight.

**Significant gaps:**
- Applications based on more traditional algorithmic systems (rule-based, non-ML) may fall outside the AI Act's scope entirely — despite potentially causing identical harm
- Providers can largely self-assess whether their system is truly high-risk — including self-assessing whether a system listed in Annex III actually poses "significant risk of harm"
- The Act barely addresses the rule of law and says nothing about private actors' normative influence over public decision-making
- Citizens have no guaranteed say in whether certain algorithmic applications are deployed by public administrations in the first place
- AI Act compliance may actually legitimize harmful applications by allowing them to be "rubberstamped" as conforming — potentially functioning as deregulation in practice

---

## Governance Commons Relevance

### Authority Node
The chapter's "transfer of public power" analysis maps directly to the Commons' authority node. Discretion does not disappear — it relocates. Governance frameworks must explicitly assign authority for algorithmic design decisions (what gets optimized, what gets weighted, what counts as a valid override) not just for deployment decisions. The private actors who build algorithmic regulation systems are exercising public authority without public accountability. Healthcare AI governance has the same structure: when a clinical AI model determines who gets escalated, who gets flagged, or what gets recommended, the people who built the model made normative decisions about those outcomes. Those decisions need to be traceable to an authority holder.

### Stop Mechanisms
All four case studies show the same pattern: harm accumulated before stop mechanisms activated, and in most cases the only mechanism that eventually worked was litigation or public scandal — years after damage was done. The Commons' stop mechanism architecture should specify triggers that precede visible harm: not "the system is producing bad outcomes" but "the system has not been validated for this population" or "the error rate exceeds threshold" or "the discrimination audit has not been completed." The Dutch and Idaho cases both represent failures where technically operating systems were systemically harming people for years without triggering any internal stop.

### Monitoring Node
The French case is a monitoring architecture failure: the error rate (30%) was apparently known or discoverable, but there was no monitoring mechanism that translated it into a deployment decision. A monitoring architecture that measures accuracy but does not feed that measurement into a deployment authorization loop is not a governance mechanism — it is documentation. The Commons monitoring architecture should specify not just what is measured but what decisions each measurement is authorized to trigger.

### Accountability and the Diffuse Responsibility Problem
The chapter's "delegated responsibility" analysis is the governance parallel to the Commons' dual-loop architecture rationale. When responsibility is shared between a system and a human reviewer without explicit allocation, it tends to concentrate nowhere. Individual clinical AI governance frameworks must name who is responsible for each decision class and make that assignment explicit — not assumed by the presence of a human in the loop.

---

## Commons Commentary: The Scale Asymmetry Problem

The chapter identifies but does not fully develop what may be the most important structural feature of algorithmic governance failures: **the asymmetry between the speed at which harm scales and the speed at which governance responds**.

In each case study, the harm was not the result of a catastrophic single failure — it was the result of a flawed system operating correctly at scale. The Dutch benefits algorithm worked as designed; the design was wrong. The Idaho Medicaid system calculated budgets as programmed; the programming was flawed. The UK grading algorithm applied its rules consistently; the rules encoded structural inequity.

Governance mechanisms built for individual decisions — administrative review, judicial appeal, oversight inspection — operate at individual speed. Algorithmic systems operate at population speed. By the time an individual complaint triggers a review, thousands of similar decisions have already been made and implemented.

This has a direct implication for clinical AI governance: governance mechanisms designed for one-at-a-time clinical decisions are structurally insufficient for AI systems making population-level decisions continuously. The Commons' dual-loop architecture addresses this by separating the internal technical loop (which must operate at AI speed) from the external human governance loop (which operates at institutional speed). But the case studies in this chapter suggest that the internal technical loop needs to be empowered to stop the system — not just flag it for human review — when predefined thresholds are breached. Waiting for the external loop to respond is precisely the pattern that converted policy flaws into humanitarian crises in each of these cases.

**Commons mapping:** This commentary reinforces the case for stop mechanisms with automatic enforcement authority, not just alert functions. It also strengthens the argument that governance frameworks must specify population-level monitoring metrics, not only individual decision review.

---

## Cross-References to Commons Argument Stack

| Paper | Connection |
|-------|-----------|
| Brundage et al. (2026) | Both argue that self-assessment by the system's deployer is insufficient — independent third-party verification is necessary for high-consequence systems. The AI Act's self-assessment regime has the same structural problem the Brundage paper argues against. |
| Hot Mess (Hägele et al., 2026) | Both identify that failures are harder to detect and attribute as systems become more complex. Smuha's "translation" problem (text to code encodes normative choices invisibly) maps to Hägele's finding that complex AI failures are incoherent rather than systematic — both are harder to audit with standard methods. |
| Dataset Condensation (Oxford, 2025) | The French case (system deployed only in mainland France, not overseas territories) is the institutional version of the reference range problem: validating a system on one population and deploying it on another. Geographic deployment inequality is a population representativeness failure with legal as well as clinical dimensions. |
| Collective Intelligence (Dorn, 2026) | Smuha's critique of automation bias (civil servants follow system suggestions because deviating requires justification) directly complements Dorn's finding that collective intelligence requires explicit norms about when and how to override. Both point to the same governance gap: override authority must be actively designed, not assumed. |

---

*Distilled for the Healthcare Governance Commons. Source: Chapter 19 in Smuha (ed.), The Cambridge Handbook of the Law, Ethics and Policy of Artificial Intelligence, Cambridge University Press, 2025. DOI: 10.1017/9781009367783. Open Access: CC-BY.*
