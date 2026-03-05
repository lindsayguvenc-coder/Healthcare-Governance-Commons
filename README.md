# Governance Commons

A living map of clinical AI governance infrastructure — connecting documents, decisions, authority, and conversations at every node of the AI deployment lifecycle.

Built by Lindsay Guvenc · Clinical Lab Scientist II / AI Governance · March 2026

## What this is

A working prototype of the governance commons concept: a tool that organizes clinical AI governance documents, frameworks, and decisions at each node of the AI deployment lifecycle. Every decision point (data validation, model selection, threshold setting, escalation design, monitoring, retirement) has:

- Linked governance documents with abstracts
- Authority matrix for who decides
- Points of contention where the field disagrees
- Checkpoints that must clear before moving forward
- Real-time AI synthesis of the node's knowledge state
- Collaborative conversation anchored to the specific node

## Stack

- React 18 + Vite
- Anthropic Claude API (for live node synthesis)
- No backend — fully static, deploys to Vercel in ~2 minutes

## Deploy to Vercel

1. Push this repo to GitHub
2. Connect repo in Vercel dashboard
3. Add environment variable: `VITE_ANTHROPIC_API_KEY` = your Anthropic API key
4. Deploy — build command is `npm run build`, output dir is `dist`

## Local development

```bash
npm install
cp .env.example .env.local
# Add your API key to .env.local
npm run dev
```

## Related work

- ECG Arrhythmia Detection Governance Demo: https://github.com/lindsayguvenc-coder/ecg-governance-demo
- Governance Commons concept document: included in repo

## Architecture

The taxonomy is the single source of truth. The matrix derives its axes from `TAXONOMY_NODES` filtered by `matrixReady: true`. To promote a new governance concept to the matrix: add it to `TAXONOMY_NODES`, set `matrixReady: true`, add a `matrixLabel`. Everything updates automatically.
