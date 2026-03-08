# Governance Commons — Project Continuation Prompt

Use this to resume work on the Healthcare Governance Commons project without losing context. Paste at the top of a new conversation.

---

## Who I am

Lindsay LaMere Guvenc. CLS II with 10+ years healthcare ops leadership (former Director of Lab and Pathology Services, Stanford Health Care; prior Sutter Health). Actively transitioning into clinical AI governance roles. Currently part-time at Alameda Health System while building portfolio and network. Neurosparkly — think in shapes and systems, learn by building, value direct unpolished communication as a collaborator filter.

---

## The project

**Healthcare Governance Commons** — a living, collaborative infrastructure map for clinical AI governance.

- **Live URL:** https://healthcare-governance-commons.vercel.app
- **GitHub:** https://github.com/lindsayguvenc-coder/Healthcare-Governance-Commons (public)
- **Stack:** React 18 + Vite, Anthropic Claude API via Vercel serverless functions, RedisLabs (raw TCP) via ioredis for persistence

### What it is (and why)

Not a governance document. Not a framework. A working surface that accumulates intelligence over time — documents, discussions, node annotations, practitioner thinking — and makes the governance puzzle assembleable collaboratively. The gap it fills: everyone is producing governance documents, nobody has built the connective tissue that makes them findable, relatable, and usable in context. The map is the artifact.

Original design intent: throw all existing info on the table, start putting the puzzle together with others, include discussion scraping at nodes, add to node summaries. A collaborative site, not a static matrix.

### Design philosophy

- **Taxonomy as single source of truth.** `TAXONOMY_NODES` drives everything. `matrixReady: true` promotes a node to the matrix. Nothing else needs to change.
- **Two-track architecture.** Public (curated library, taxonomy, matrix, synthesis — visible to anyone). Private/password-gated (intake panel, personal doc dumps, working notes — Lindsay only). Promotion from personal → public is deliberate, mirrors commons governance principles.
- **The governance document vs. governance system distinction.** If it only captures consensus it's a liability shield. If it actively generates productive friction at the right moments it's doing governance work. Everything is built toward the latter.

---

## File structure

```
api/
  synthesize.js       — Anthropic API proxy (all Claude calls route through here)
  documents.js        — Redis save/load/delete for intake panel (password-gated, CommonJS)
  package.json        — {"type": "commonjs"} — critical, makes ioredis work in Vercel
src/
  GovernanceCommons.jsx   — entire frontend, single file (~1953 lines)
  main.jsx            — entry point
package.json          — includes ioredis dependency
vercel.json           — build config
index.html
vite.config.js
```

### Environment variables (in Vercel)
- `VITE_ANTHROPIC_API_KEY` — Anthropic API key
- `INTAKE_PASSWORD` — password gate for intake panel
- `REDIS_URL` — RedisLabs connection string (format: `redis://default:PASSWORD@HOST:PORT`)

### Critical infrastructure notes
- `api/package.json` with `{"type": "commonjs"}` is REQUIRED — without it ioredis fails with ERR_MODULE_NOT_FOUND
- Root `package.json` must include `"ioredis": "^5.3.2"` in dependencies
- `api/synthesize.js` uses ESM (`export default`), `api/documents.js` uses CommonJS (`module.exports`) — this is intentional and correct
- When updating files in GitHub, delete-and-recreate is more reliable than pencil/Ctrl+A for large files

---

## Current architecture — 5 layers

### ① Taxonomy Navigator (left sidebar)
- Nodes organized by governance loop: Internal, Handoff, External, Commons
- `matrixReady` badge on promoted nodes
- Clicking a node loads the detail panel

### ② Document Repository (tab)
- 14 curated documents with full abstracts, URLs, taxonomy routing
- Expandable rows, type filters (regulation / peer-reviewed / guideline / practitioner / report)
- Sources: FDA PCCP, FDA lifecycle, FDA transparency, FDA GMLP, FDA CDS, Khera JAMA, Goddard JAMIA, ECG governance demo (Lindsay's GitHub), Westgard-ML adaptation, IHI Leape, HAIP, AMA AI policy, Haug/Drazen NEJM, Apollo Research

### ③ Node Detail Panel (main panel when taxonomy tab active)
Each node has four sections stacked:
- **Node metadata** — loop, question, components, contention, gap, matrix status
- **AI Synthesis** (AICurationPanel) — real Claude API call synthesizing linked docs + node context. Points of contention and known gaps displayed below.
- **⚡ Facetious Collaborator** (FacetiousCollaborator) — see below
- **Collaborative Chat** (CollabChat) — seeded with real attributed insights from Lindsay, open for additions

### ④ Intake Panel (password-gated tab) — FULLY WORKING
- Three input modes: URL, Paste text, PDF/file upload
- Calls Claude API to: extract metadata, write abstract, check overlap against existing library, suggest taxonomy node routing
- Returns: title, source, year, type, abstract, overlap detection (with what's new highlighted), suggested nodes, routing rationale
- **Save persists to RedisLabs via ioredis — working**
- Personal library visible after unlock, persists across sessions
- Delete individual docs from personal library
- Password gate uses `INTAKE_PASSWORD` env var

### ⑤ Matrix View (tab)
- Derived automatically from `matrixReady: true` nodes × ALL_USE_CASES
- Cell detail shows docs/cases/contested/threads counts + status
- Currently 7 promoted concepts × 6 use case types

---

## The Facetious Collaborator — concept and implementation

### Why it exists

Governance frameworks have a specific failure mode: everything looks coherent on paper and nobody says the uncomfortable thing out loud. The authority matrix is complete. The escalation pathway is documented. The stop mechanism exists. And then real deployment happens and it quietly doesn't work because someone avoided a conversation, or the "responsible party" was assigned without actually agreeing.

The facetious collaborator is a designed mechanism for generating that friction without the political cost of a human generating it. "The governance framework raised a concern" is a completely different political sentence than "Lindsay thinks this is a problem." It's a blame diffuser and truth-teller simultaneously.

**The governance document vs. governance system distinction:** if it only captures consensus it's a liability shield. If it actively generates productive friction it's doing governance work. The facetious collaborator is the difference between the two.

### Design

Not a chatbot that adapts to you. A **perspective-taking tool.** The value is "here's what the person across the table from you is actually thinking but probably not saying."

Eleven roles, each with a distinct voice and specific friction type:

| Role | Core friction |
|------|---------------|
| Clinical Ops | Coverage, workflows, what actually happens at 2am |
| Clinician | Cognitive load at point of care, disagreement with model |
| Patient | Consent, opt-out, recourse when wrong |
| Compliance / Legal | Documentation trails, regulatory exposure, post-incident challenge |
| Risk | Failure modes, liability, institutional exposure |
| Patient Safety | Harm profile, near-miss capture, adverse event reporting |
| Executive Leadership | Strategic rationale, resource commitment, long-term ownership |
| Vendor | Contract terms, what institution actually owns vs. vendor covers |
| AI Engineering | Model validation on this population, confidence calibration, distribution shift |
| Enterprise IT | EHR integration, who owns the break at 3am, approved vendor list, downtime protocol |
| Ethics | Who benefits, who bears cost if wrong, equity implications, when to stop even if metrics look fine |

Each role tab shows a voice profile. "◉ ask" generates 3-5 specific, direct, role-accurate uncomfortable questions. Responses cache per node+role. Dot indicator on tabs shows which roles have been asked.

---

## What's working / what's next

### All working ✅
- Taxonomy navigator
- Document repository (14 curated docs)
- AI synthesis per node
- Facetious collaborator (11 roles, per-node, cached responses)
- Collaborative chat (seeded with Lindsay's insights)
- Matrix view
- Intake panel: URL, paste, PDF upload modes
- Overlap detection
- Taxonomy routing suggestions
- Persistent personal library (Redis)
- Password gate

### Next priorities
1. Wire user-saved docs into the main document repository view (currently only visible in intake panel)
2. Node annotations — ability to add working notes directly to a node (persistent, private)
3. Promote more taxonomy nodes to matrix (several are `matrixReady: false` with good content)
4. Make collaborative chat threads persistent (currently session-only for new additions)
5. Public contribution pathway — how does someone outside Lindsay's session add to the commons?

---

## Lindsay's portfolio context

The Commons is one of three active portfolio pieces:

1. **ECG Arrhythmia Governance Demo** — complete. Public at github.com/lindsayguvenc-coder/ecg-governance-demo.
2. **PCT-Guided Antibiotic Stewardship Governance Model** — scaffolded, waiting on PhysioNet BigQuery credentialing.
3. **Healthcare Governance Commons** — this tool. Most differentiating because nothing like it exists.

Applied to: UCSF Transformation Associate Director, Anthropic Product Lead Healthcare. Part-time at Alameda Health System.

---

## Conversation continuity notes

- We work iteratively — build now, tidy later
- Direct communication is a collaborator filter, not a liability
- The Commons is meant to be collaborative from the start
- The facetious collaborator concept: designed dissent as political protection — "the framework raised a concern" vs. "Lindsay thinks this is a problem"
- GitHub's web editor sometimes silently fails to replace large files — delete-and-recreate is the reliable method for GovernanceCommons.jsx
- Compression happens in long sessions — this document exists to restore context when it does

---

*Last updated: March 2026. Resume by pasting this document at the top of a new conversation.*
