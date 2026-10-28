// The merged node page. One design, fed by src/data/nodes.json, used both at
// /nodes/:id and inside the Taxonomy tab. Order follows the Oct 27 wireframe.
import { useState, useEffect } from "react";
import REG from "./data/regulatory.json";
import TOOLBOX from "./data/toolbox.json";

const USE_CASE_LABELS = {
  diagnostic: "Diagnostic aid", screening: "Screening", monitoring: "Monitoring",
  triage: "Triage", treatment: "Treatment rec.", admin: "Admin / ops",
};

const STATUS_HELP = {
  Unknown: "The field doesn't know yet",
  Contested: "Credible sources disagree",
  Unknowable: "Can't be settled by more data",
};

export default function NodeBody({ node, C, loopMeta, docLibrary = [], aiPanels = null }) {
  const lm = loopMeta[node.loop] || { color: C.commons, label: node.loopLabel };
  const reg = REG.nodes[node.id] || { required: [], recommended: [], practiced: [] };
  const tools = (TOOLBOX.byNode[node.id] || []).map(k => ({ key: k, ...TOOLBOX.tools[k] })).filter(t => t.name);

  // Evidence: the node page's curated list plus library documents tagged to this node.
  const libDocs = docLibrary.filter(d => (d.nodes || []).includes(node.id));
  const evidence = [...node.evidence];
  libDocs.forEach(d => {
    if (!evidence.some(e => norm(e.title) === norm(d.title))) {
      evidence.push({ title: d.title, meta: `${d.source} · ${d.year}`, url: d.url, type: d.type });
    }
  });
  const years = evidence.map(e => parseInt((e.meta || "").match(/(19|20)\d\d/)?.[0], 10)).filter(Boolean);
  const types = {};
  libDocs.forEach(d => { types[d.type] = (types[d.type] || 0) + 1; });

  const s = styles(C, lm.color);

  // Contributions Lindsay has approved for this node.
  const [contrib, setContrib] = useState([]);
  useEffect(() => {
    let live = true;
    fetch(`/api/suggest?node=${encodeURIComponent(node.id)}`)
      .then(r => (r.ok ? r.json() : { items: [] }))
      .then(d => { if (live) setContrib(d.items || []); })
      .catch(() => {});
    return () => { live = false; };
  }, [node.id]);
  const approved = kind => contrib.filter(c => c.kind === kind);

  return (
    <div style={s.page}>
      {/* 1-3 · What is this node */}
      <header style={s.hero}>
        <div style={s.row}>
          <span style={s.loopPill}>{(node.loopLabel || lm.label || "").toUpperCase()}</span>
          {node.status && (
            <span style={s.chip(C.commons)} title={STATUS_HELP[node.status] || ""}>
              Status · {node.status}
            </span>
          )}
          <span style={s.chip(C.textDim || "#7d8e9e")}>
            {node.mandatory ? "Required for every deployment" : "Context-dependent"} · pending expert review
          </span>
        </div>
        <h1 style={s.title}><span style={{ color: lm.color, marginRight: 10 }}>{node.icon}</span>{node.label}</h1>
        <p style={s.question}>{node.question}</p>
      </header>

      <Band s={s} label="What it consists of">
        <div style={s.grid}>
          <Card s={s} title="Components">
            <div style={s.chips}>{node.components.map(c => <span key={c} style={s.compChip}>{c}</span>)}</div>
          </Card>
          <Card s={s} title="Artifacts you should have">
            {node.artifacts.length ? (
              <ul style={s.list}>{node.artifacts.map(a => <li key={a}>{a}</li>)}</ul>
            ) : <Empty s={s}>None listed yet.</Empty>}
          </Card>
        </div>
        {node.frameworks.map(fw => (
          <Card key={fw.title} s={s} title={fw.title || "Framework"}>
            <div style={fw.kind === "cluster" ? s.chips : s.fwGrid}>
              {fw.items.map(it => fw.kind === "cluster" ? (
                <span key={it.label} style={s.compChip}>{it.label}</span>
              ) : (
                <div key={it.label} style={s.fwItem}>
                  <div style={s.fwLabel}>{it.label}</div>
                  {it.sublabel && <div style={s.fwSub}>{it.sublabel}</div>}
                  <div style={s.body}>{it.desc}</div>
                </div>
              ))}
            </div>
          </Card>
        ))}
        {(node.callouts || []).map(co => (
          <div key={co.title} style={s.callout}>
            <div style={s.fwLabel}>{co.title}</div>
            <div style={s.body}>{co.text}</div>
          </div>
        ))}
        <Card s={s} title="Evidence at a glance">
          <div style={s.stats}>
            <Stat s={s} n={evidence.length} label="sources linked" />
            <Stat s={s} n={node.notes.length} label="practitioner notes" />
            <Stat s={s} n={years.length ? Math.max(...years) : "—"} label="newest source" />
            <Stat s={s} n={reg.required.length} label="binding rules found" />
          </div>
          {Object.keys(types).length > 0 && (
            <div style={s.small}>Library sources by type: {Object.entries(types).map(([k, v]) => `${v} ${k}`).join(" · ")}</div>
          )}
          <div style={s.small}>Source frequency, gaps, and confidence arrive with the data component.</div>
        </Card>
      </Band>

      <Band s={s} label="Where the field stands">
        {node.insight && (
          <div style={s.insight}><span style={s.kicker}>Key insight</span>{node.insight}</div>
        )}
        <div style={s.grid}>
          <Card s={s} title="Contested" accent={C.handoff}><div style={s.body}>{node.contention}</div></Card>
          <Card s={s} title={`Gap${node.status ? " · " + node.status : ""}`} accent={C.red}><div style={s.body}>{node.gap}</div></Card>
        </div>
        <Card s={s} title="Settled">
          <Empty s={s}>Not mapped yet. What credible sources agree on will be listed here, with how many say it.</Empty>
        </Card>
        <Card s={s} title={`Required · recommended · practiced (as of ${REG.asOf})`}>
          <div style={s.regGrid}>
            {[["Required", reg.required], ["Recommended", reg.recommended], ["Practiced", reg.practiced]].map(([h, items]) => (
              <div key={h} style={{ minWidth: 0 }}>
                <div style={s.kicker}>{h}</div>
                {items.length ? (
                  <ul style={s.list}>
                    {items.map(it => (
                      <li key={it.text}>
                        {it.text}
                        {it.binds && <span style={s.binds}> binds: {it.binds}</span>}
                        {!it.verified && <span style={s.unverified}> unverified</span>}
                      </li>
                    ))}
                  </ul>
                ) : <Empty s={s}>Nothing found.</Empty>}
              </div>
            ))}
          </div>
        </Card>
        <div style={s.grid}>
          <Card s={s} title="Movement" dashed>
            <ul style={s.list}>
              {REG.upcoming.map(u => <li key={u.what}><b style={{ color: C.text }}>{u.when}</b> · {u.what}</li>)}
            </ul>
            <div style={s.small}>Field-wide dates for now. Node-specific changes arrive with the data component.</div>
          </Card>
          <Card s={s} title="Open questions">
            {approved("question").length ? (
              <ul style={s.list}>{approved("question").map(q => <li key={q.id}>{q.text}<span style={s.binds}> contributed · reviewed</span></li>)}</ul>
            ) : <Empty s={s}>None collected yet.</Empty>}
            <Contribute s={s} C={C} nodeId={node.id} kind="question" label="Ask a question" />
          </Card>
        </div>
      </Band>

      <Band s={s} label="Evidence">
        <div style={s.grid}>
          <Card s={s} title={`Key evidence (${evidence.length + approved("source").length})`}>
            {evidence.length ? evidence.map(e => (
              <div key={e.title} style={s.evItem}>
                <div style={{ color: C.text, fontSize: 13, lineHeight: 1.4 }}>{e.title}</div>
                <div style={s.evMeta}>
                  <span>{e.meta}</span>
                  {e.url && <a href={e.url} target="_blank" rel="noopener noreferrer" style={s.link}>open ↗</a>}
                </div>
              </div>
            )) : <Empty s={s}>No sources linked yet.</Empty>}
            {approved("source").map(c => (
              <div key={c.id} style={s.evItem}>
                <div style={{ color: C.text, fontSize: 13, lineHeight: 1.4 }}>{c.text}</div>
                <div style={s.evMeta}>
                  <span>contributed · reviewed</span>
                  <a href={c.url} target="_blank" rel="noopener noreferrer" style={s.link}>open ↗</a>
                </div>
              </div>
            ))}
            <Contribute s={s} C={C} nodeId={node.id} kind="source" label="Suggest a source" />
          </Card>
          <Card s={s} title={`Practitioner notes (${node.notes.length + approved("note").length})`}>
            {node.notes.length ? node.notes.map((n, i) => (
              <div key={i} style={s.note(n.gem)}>
                <div style={s.body}>{n.text}</div>
                <div style={s.evMeta}><span>{n.by}{n.when ? " · " + n.when : ""}</span></div>
              </div>
            )) : (approved("note").length ? null : <Empty s={s}>No notes yet.</Empty>)}
            {approved("note").map(n => (
              <div key={n.id} style={s.note(false)}>
                <div style={s.body}>{n.text}</div>
                <div style={s.evMeta}><span>{[n.name || "Anonymous practitioner", n.role && `${n.role} (self-described)`].filter(Boolean).join(" · ")} · contributed · reviewed</span></div>
              </div>
            ))}
            <Contribute s={s} C={C} nodeId={node.id} kind="note" label="Add a note" />
          </Card>
        </div>
      </Band>

      <Band s={s} label="Think with it">
        {aiPanels && <div style={s.aiWrap}>{aiPanels}</div>}
        {Object.keys(node.useCases).length > 0 && (
          <Card s={s} title="Across use cases">
            <div style={s.ucGrid}>
              {Object.entries(node.useCases).map(([uc, cell]) => (
                <div key={uc} style={s.ucCell}>
                  <div style={s.kicker}>{USE_CASE_LABELS[uc] || uc}</div>
                  <div style={s.body}>{cell.summary}</div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </Band>

      <Band s={s} label="Toolbox">
        <Card s={s} title="Things to use for this node">
          {tools.length ? (
            <ul style={s.list}>
              {tools.map(t => (
                <li key={t.key}>
                  <a href={t.url} target={t.url.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" style={s.link}>{t.name}</a>
                  <span style={s.binds}> {t.kind}</span>
                </li>
              ))}
            </ul>
          ) : (approved("tool").length ? null : <Empty s={s}>Nothing matched yet.</Empty>)}
          {approved("tool").length > 0 && (
            <ul style={s.list}>
              {approved("tool").map(t => (
                <li key={t.id}><a href={t.url} target="_blank" rel="noopener noreferrer" style={s.link}>{t.text}</a><span style={s.binds}> contributed · reviewed</span></li>
              ))}
            </ul>
          )}
          <Contribute s={s} C={C} nodeId={node.id} kind="tool" label="Suggest a tool" />
        </Card>
      </Band>

      <Band s={s} label="Discussion to date">
        <Card s={s} title="Discussion" dashed>
          <Empty s={s}>Coming. Each node will get a thread on an outside platform, and the best posts will be promoted into notes and open questions.</Empty>
        </Card>
      </Band>
    </div>
  );
}

function norm(t) { return (t || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40); }

function Band({ s, label, children }) {
  return (
    <section style={s.band}>
      <div style={s.bandLabel}>{label}</div>
      {children}
    </section>
  );
}

function Card({ s, title, children, accent, dashed }) {
  return (
    <div style={s.card(accent, dashed)}>
      <div style={s.cardTitle(accent)}>{title}</div>
      {children}
    </div>
  );
}

function Stat({ s, n, label }) {
  return (
    <div style={s.stat}>
      <div style={s.statN}>{n}</div>
      <div style={s.small}>{label}</div>
    </div>
  );
}

function Empty({ s, children }) { return <div style={s.empty}>{children}</div>; }

// Contribution forms. Everything goes to Lindsay's review queue; nothing is
// published until she approves it. No email or contact details are collected.
const FORM_COPY = {
  source:   { text: "Why it belongs here (one line)", url: "Link to the source" },
  tool:     { text: "What it is and how it helps (one line)", url: "Link to the tool" },
  question: { text: "Your question" },
  note:     { text: "Your note from practice" },
};

function Contribute({ s, C, nodeId, kind, label }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ text: "", url: "", name: "", role: "", consent: false, website: "" });
  const [state, setState] = useState({ busy: false, msg: null, ok: false });
  const copy = FORM_COPY[kind];
  const needsUrl = kind === "source" || kind === "tool";
  const set = k => e => setF(v => ({ ...v, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const idp = `c-${nodeId}-${kind}`;

  const submit = async e => {
    e.preventDefault();
    setState({ busy: true, msg: null, ok: false });
    try {
      const r = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, nodeId, ...f }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setState({ busy: false, ok: true, msg: "Received. It's waiting for review; if it's accepted, it will appear on this page." });
        setF({ text: "", url: "", name: "", role: "", consent: false, website: "" });
      } else {
        setState({ busy: false, ok: false, msg: d.error || "That didn't go through. Nothing was saved." });
      }
    } catch {
      setState({ busy: false, ok: false, msg: "That didn't go through. Nothing was saved." });
    }
  };

  if (!open) {
    return (
      <div style={s.contribute}>
        <button type="button" style={s.btnOpen} onClick={() => setOpen(true)}>{label}</button>
        {state.ok && <span style={s.small}>{state.msg}</span>}
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={s.form}>
      {needsUrl && (
        <label style={s.field} htmlFor={`${idp}-url`}>
          <span style={s.small}>{copy.url}</span>
          <input id={`${idp}-url`} type="url" required value={f.url} onChange={set("url")} placeholder="https://" style={s.input} />
        </label>
      )}
      <label style={s.field} htmlFor={`${idp}-text`}>
        <span style={s.small}>{copy.text}</span>
        {kind === "note" || kind === "question" ? (
          <textarea id={`${idp}-text`} required rows={kind === "note" ? 4 : 2} value={f.text} onChange={set("text")} style={s.input} />
        ) : (
          <input id={`${idp}-text`} required value={f.text} onChange={set("text")} style={s.input} />
        )}
      </label>
      {kind === "note" && (
        <>
          <div style={s.formRow}>
            <label style={s.field} htmlFor={`${idp}-name`}>
              <span style={s.small}>Name to publish (optional)</span>
              <input id={`${idp}-name`} value={f.name} onChange={set("name")} style={s.input} />
            </label>
            <label style={s.field} htmlFor={`${idp}-role`}>
              <span style={s.small}>Role to publish (optional, shown as self-described)</span>
              <input id={`${idp}-role`} value={f.role} onChange={set("role")} style={s.input} />
            </label>
          </div>
          <label style={{ ...s.small, display: "flex", gap: 8, alignItems: "flex-start" }} htmlFor={`${idp}-consent`}>
            <input id={`${idp}-consent`} type="checkbox" checked={f.consent} onChange={set("consent")} />
            If accepted, this note will be published on this page with the name and role I entered, or as "Anonymous practitioner."
          </label>
        </>
      )}
      {/* Honeypot: hidden from people, filled in by bots. */}
      <input type="text" name="website" value={f.website} onChange={set("website")} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }} />
      <div style={s.small}>Reviewed by hand before anything appears. Don't include patient information or contact details.</div>
      <div style={s.contribute}>
        <button type="submit" disabled={state.busy} style={s.btnOpen}>{state.busy ? "Sending…" : "Send for review"}</button>
        <button type="button" onClick={() => setOpen(false)} style={s.btnGhost}>Cancel</button>
      </div>
      {state.msg && <div style={{ ...s.small, color: state.ok ? C.external : C.red }} role="status">{state.msg}</div>}
    </form>
  );
}

function styles(C, accent) {
  const dim = "#7d8e9e";
  return {
    page: { maxWidth: 1040, margin: "0 auto", padding: "24px 20px 64px", display: "flex", flexDirection: "column", gap: 28, color: C.text, fontFamily: "'DM Sans', system-ui, sans-serif" },
    hero: { display: "flex", flexDirection: "column", gap: 10, paddingBottom: 18, borderBottom: `1px solid ${C.border}` },
    row: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" },
    loopPill: { fontFamily: C.mono, fontSize: 10, letterSpacing: "0.08em", fontWeight: 700, color: accent, border: `1px solid ${accent}55`, background: accent + "15", padding: "3px 8px", borderRadius: 3 },
    chip: col => ({ fontFamily: C.mono, fontSize: 10, letterSpacing: "0.04em", color: col, border: `1px solid ${col}55`, padding: "3px 8px", borderRadius: 999 }),
    title: { fontFamily: C.serif, fontWeight: 400, fontSize: "clamp(26px, 5vw, 38px)", lineHeight: 1.15, margin: 0 },
    question: { margin: 0, color: dim, fontStyle: "italic", fontSize: 15, maxWidth: 680 },
    band: { display: "flex", flexDirection: "column", gap: 10 },
    bandLabel: { fontFamily: C.mono, fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: dim },
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 10 },
    fwGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 },
    regGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 },
    ucGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 },
    card: (acc, dashed) => ({ background: dashed ? "transparent" : C.surface, border: `1px ${dashed ? "dashed" : "solid"} ${acc ? acc + "55" : C.border}`, borderRadius: 6, padding: 14, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }),
    cardTitle: acc => ({ fontFamily: C.mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, color: acc || accent }),
    chips: { display: "flex", flexWrap: "wrap", gap: 6 },
    compChip: { fontFamily: C.mono, fontSize: 11, padding: "4px 9px", borderRadius: 3, background: C.surface3, border: `1px solid ${C.border}` },
    list: { margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6, fontSize: 13, lineHeight: 1.55, color: "#b9c7d3" },
    body: { fontSize: 13, lineHeight: 1.65, color: "#b9c7d3" },
    fwItem: { background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 4, padding: 10, display: "flex", flexDirection: "column", gap: 4 },
    fwLabel: { fontWeight: 600, fontSize: 13, color: C.text },
    fwSub: { fontFamily: C.mono, fontSize: 10.5, color: accent },
    callout: { borderLeft: `3px solid ${accent}`, background: C.surface2, padding: "10px 12px", borderRadius: "0 4px 4px 0", display: "flex", flexDirection: "column", gap: 4 },
    insight: { borderLeft: `3px solid ${C.commons}`, padding: "8px 12px", fontSize: 14, lineHeight: 1.6, display: "flex", flexDirection: "column", gap: 4 },
    kicker: { fontFamily: C.mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: dim },
    stats: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8 },
    stat: { background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 4, padding: "8px 10px" },
    statN: { fontFamily: C.mono, fontSize: 20, color: C.text, fontVariantNumeric: "tabular-nums" },
    small: { fontSize: 11.5, color: dim, lineHeight: 1.5 },
    empty: { fontSize: 12.5, color: dim, fontStyle: "italic" },
    evItem: { borderBottom: `1px solid ${C.border}`, padding: "6px 0", display: "flex", flexDirection: "column", gap: 3 },
    evMeta: { display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", fontFamily: C.mono, fontSize: 10.5, color: dim },
    link: { color: accent, textDecoration: "none" },
    binds: { fontFamily: C.mono, fontSize: 10.5, color: C.internal },
    unverified: { fontFamily: C.mono, fontSize: 10.5, color: C.handoff },
    note: gem => ({ borderLeft: `2px solid ${gem ? C.commons : C.border}`, paddingLeft: 10, display: "flex", flexDirection: "column", gap: 4, marginBottom: 6 }),
    ucCell: { background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 4, padding: 10, display: "flex", flexDirection: "column", gap: 4 },
    aiWrap: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, overflow: "hidden" },
    contribute: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 4 },
    btnOpen: { fontFamily: C.mono, fontSize: 11, padding: "5px 10px", borderRadius: 4, background: accent + "15", border: `1px solid ${accent}55`, color: accent, cursor: "pointer" },
    btnGhost: { fontFamily: C.mono, fontSize: 11, padding: "5px 10px", borderRadius: 4, background: "transparent", border: `1px solid ${C.border}`, color: dim, cursor: "pointer" },
    form: { position: "relative", display: "flex", flexDirection: "column", gap: 8, marginTop: 6, padding: 10, border: `1px solid ${C.border}`, borderRadius: 4, background: C.surface2 },
    formRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 },
    field: { display: "flex", flexDirection: "column", gap: 4, minWidth: 0 },
    input: { width: "100%", boxSizing: "border-box", padding: "7px 9px", borderRadius: 4, background: C.surface3, border: `1px solid ${C.border}`, color: C.text, fontFamily: "inherit", fontSize: 13 },
  };
}
