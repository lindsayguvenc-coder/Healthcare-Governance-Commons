import { useState, useEffect, useRef } from "react";

const C = {
  bg:           "#07090f",
  surface:      "#0d1117",
  surface2:     "#111820",
  border:       "#1c2a3a",
  internal:     "#38bdf8",
  external:     "#10b981",
  handoff:      "#f59e0b",
  commons:      "#a78bfa",
  text:         "#dce8f0",
  textDim:      "#607080",
  textDimmer:   "#2d3f50",
  mono:         "'DM Mono', 'Fira Code', monospace",
  serif:        "'DM Serif Display', Georgia, serif",
};

const LOOP_META = {
  internal: { label: "Internal Loop",   color: C.internal,  question: "Is it behaving as designed?" },
  handoff:  { label: "Handoff Zone",    color: C.handoff,   question: "Where internal signals become external decisions" },
  external: { label: "External Loop",   color: C.external,  question: "Is what it was designed to do still appropriate?" },
  commons:  { label: "Gov. Commons",    color: C.commons,   question: "Is the governance infrastructure itself current?" },
};

// Revised positions — more separation between clusters, commons clearly elevated
// Internal loop: tight left cluster, y range 50-72
// Handoff: center bridge, y range 38-62  
// External loop: tight right cluster, y range 45-78
// Commons: high center, clearly above everything at y=8
const NODE_POSITIONS = {
  // Internal technical loop — left, mid-low
  norm:             { x: 16, y: 65 },
  watcher:          { x: 22, y: 50 },
  // Handoff zone — center bridge
  h1:               { x: 40, y: 38 },
  h2:               { x: 42, y: 60 },
  h3:               { x: 34, y: 50 },
  h4:               { x: 50, y: 50 },
  // External human loop — right, mid-low
  escalation:       { x: 62, y: 38 },
  adjudicate:       { x: 72, y: 48 },
  threshold_review: { x: 68, y: 62 },
  authority:        { x: 60, y: 68 },
  stop:             { x: 80, y: 60 },
  override:         { x: 82, y: 44 },
  validation:       { x: 74, y: 75 },
  // Commons — high center, clearly elevated above everything
  commons:          { x: 50, y: 8 },
};

const CONNECTIONS = [
  ["watcher", "h1"],
  ["watcher", "norm"],
  ["norm", "h2"],
  ["h1", "escalation"],
  ["h1", "h3"],
  ["h2", "authority"],
  ["h2", "h4"],
  ["h3", "adjudicate"],
  ["h4", "threshold_review"],
  ["escalation", "adjudicate"],
  ["escalation", "stop"],
  ["authority", "stop"],
  ["authority", "override"],
  ["authority", "validation"],
  ["adjudicate", "h4"],
  ["threshold_review", "authority"],
  ["stop", "override"],
  ["override", "validation"],
  // Commons connections — longer, more prominent
  ["commons", "h2"],
  ["commons", "authority"],
  ["commons", "watcher"],
];

// Mark which connections are from commons
const COMMONS_CONNECTIONS = new Set(["commons-h2", "commons-authority", "commons-watcher"]);

const TAXONOMY_NODES_SLIM = [
  { id: "norm",             loop: "internal", label: "Normalization Layer",          icon: "⊞", mandatory: true  },
  { id: "watcher",          loop: "internal", label: "Watcher / Signal Layer",       icon: "◎", mandatory: true  },
  { id: "h1",               loop: "handoff",  label: "Escalation Gate",              icon: "↑", mandatory: true  },
  { id: "h3",               loop: "handoff",  label: "Cold Trigger Intake",          icon: "⟳", mandatory: false },
  { id: "h2",               loop: "handoff",  label: "Threshold Authority",          icon: "≡", mandatory: true  },
  { id: "h4",               loop: "handoff",  label: "Dispute Resolution Return",    icon: "⊗", mandatory: false },
  { id: "escalation",       loop: "external", label: "Escalation Review",            icon: "↑↑",mandatory: true  },
  { id: "adjudicate",       loop: "external", label: "Dispute Adjudication",         icon: "⊡", mandatory: false },
  { id: "threshold_review", loop: "external", label: "Threshold Review",             icon: "◈", mandatory: true  },
  { id: "authority",        loop: "external", label: "Authority Tiers",              icon: "⊙", mandatory: true  },
  { id: "stop",             loop: "external", label: "Stop Mechanisms",              icon: "⊗", mandatory: true  },
  { id: "override",         loop: "external", label: "Human Override Protocols",     icon: "⟳", mandatory: true  },
  { id: "validation",       loop: "external", label: "Deployment Readiness",         icon: "✓", mandatory: true  },
  { id: "commons",          loop: "commons",  label: "Governance Commons",           icon: "◉", mandatory: true  },
];

function useSize(ref) {
  const [size, setSize] = useState({ w: 800, h: 500 });
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return size;
}

export default function ConstellationMap({ onSelectNode }) {
  const containerRef = useRef(null);
  const { w, h } = useSize(containerRef);
  const [hovered, setHovered] = useState(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 100);
    return () => clearTimeout(t);
  }, []);

  const px = (xPct, yPct) => ({
    x: (xPct / 100) * w,
    y: (yPct / 100) * h,
  });

  const nodeRadius = Math.max(6, Math.min(11, w / 75));
  const commonsRadius = nodeRadius * 1.8;

  return (
    <div ref={containerRef} style={{
      position: "relative",
      width: "100%",
      height: "100%",
      background: C.bg,
      overflow: "hidden",
    }}>
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
        <defs>
          {/* Stronger, more distinct glow regions */}
          <radialGradient id="glow-internal" cx="20%" cy="62%" r="26%">
            <stop offset="0%" stopColor={C.internal} stopOpacity="0.10"/>
            <stop offset="60%" stopColor={C.internal} stopOpacity="0.04"/>
            <stop offset="100%" stopColor={C.internal} stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="glow-external" cx="72%" cy="58%" r="30%">
            <stop offset="0%" stopColor={C.external} stopOpacity="0.10"/>
            <stop offset="60%" stopColor={C.external} stopOpacity="0.04"/>
            <stop offset="100%" stopColor={C.external} stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="glow-handoff" cx="44%" cy="50%" r="14%">
            <stop offset="0%" stopColor={C.handoff} stopOpacity="0.08"/>
            <stop offset="100%" stopColor={C.handoff} stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="glow-commons" cx="50%" cy="8%" r="22%">
            <stop offset="0%" stopColor={C.commons} stopOpacity="0.14"/>
            <stop offset="50%" stopColor={C.commons} stopOpacity="0.05"/>
            <stop offset="100%" stopColor={C.commons} stopOpacity="0"/>
          </radialGradient>
          <filter id="node-glow">
            <feGaussianBlur stdDeviation="2.5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="commons-glow">
            <feGaussianBlur stdDeviation="5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Ambient loop regions — stronger opacity */}
        <rect width="100%" height="100%" fill="url(#glow-internal)"/>
        <rect width="100%" height="100%" fill="url(#glow-external)"/>
        <rect width="100%" height="100%" fill="url(#glow-handoff)"/>
        <rect width="100%" height="100%" fill="url(#glow-commons)"/>

        {/* Horizontal divider line — faint, separating commons from the loops below */}
        <line
          x1="10%" y1="20%" x2="90%" y2="20%"
          stroke={C.commons}
          strokeWidth={0.5}
          strokeOpacity={0.12}
          strokeDasharray="4 8"
        />

        {/* Connection lines */}
        {CONNECTIONS.map(([a, b], i) => {
          const posA = NODE_POSITIONS[a];
          const posB = NODE_POSITIONS[b];
          if (!posA || !posB) return null;
          const pa = px(posA.x, posA.y);
          const pb = px(posB.x, posB.y);
          const nodeA = TAXONOMY_NODES_SLIM.find(n => n.id === a);
          const nodeB = TAXONOMY_NODES_SLIM.find(n => n.id === b);
          const isHovered = hovered === a || hovered === b;
          const isCommonsConn = a === "commons" || b === "commons";
          const colorA = LOOP_META[nodeA?.loop]?.color || C.textDimmer;
          const colorB = LOOP_META[nodeB?.loop]?.color || C.textDimmer;
          const gradId = `conn-${i}`;
          return (
            <g key={`conn-${a}-${b}`}>
              <defs>
                <linearGradient id={gradId} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor={colorA} stopOpacity={isHovered ? 0.6 : isCommonsConn ? 0.25 : 0.15}/>
                  <stop offset="100%" stopColor={colorB} stopOpacity={isHovered ? 0.6 : isCommonsConn ? 0.25 : 0.15}/>
                </linearGradient>
              </defs>
              <line
                x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                stroke={`url(#${gradId})`}
                strokeWidth={isHovered ? 2 : isCommonsConn ? 1.2 : 0.8}
                strokeDasharray={isCommonsConn ? "3 5" : "none"}
                style={{ transition: "stroke-width 0.2s" }}
              />
            </g>
          );
        })}

        {/* Regular nodes */}
        {TAXONOMY_NODES_SLIM.filter(n => n.id !== "commons").map((node, idx) => {
          const pos = NODE_POSITIONS[node.id];
          if (!pos) return null;
          const { x, y } = px(pos.x, pos.y);
          const lm = LOOP_META[node.loop];
          const isHov = hovered === node.id;
          const delay = idx * 50;

          return (
            <g
              key={node.id}
              style={{
                cursor: "pointer",
                opacity: entered ? 1 : 0,
                transition: `opacity 0.6s ease ${delay}ms`,
              }}
              onMouseEnter={() => setHovered(node.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelectNode(node.id)}
            >
              {/* Hover ring */}
              {isHov && (
                <circle cx={x} cy={y} r={nodeRadius + 12}
                  fill="none" stroke={lm.color} strokeWidth={1} strokeOpacity={0.25}
                />
              )}
              {/* Halo */}
              <circle cx={x} cy={y} r={nodeRadius * 2.8}
                fill={lm.color} fillOpacity={isHov ? 0.14 : 0.05}
                style={{ transition: "fill-opacity 0.2s" }}
              />
              {/* Core */}
              <circle cx={x} cy={y} r={nodeRadius}
                fill={C.surface2} stroke={lm.color}
                strokeWidth={isHov ? 2.5 : 1.5}
                filter="url(#node-glow)"
                style={{ transition: "stroke-width 0.15s" }}
              />
              {/* Inner dot */}
              <circle cx={x} cy={y} r={nodeRadius * 0.35}
                fill={lm.color} fillOpacity={isHov ? 1 : 0.8}
              />
              {/* Optional marker */}
              {!node.mandatory && (
                <circle cx={x + nodeRadius * 0.85} cy={y - nodeRadius * 0.85} r={2}
                  fill={C.textDimmer}
                />
              )}
            </g>
          );
        })}

        {/* Commons node — special treatment, prominent */}
        {(() => {
          const pos = NODE_POSITIONS["commons"];
          const { x, y } = px(pos.x, pos.y);
          const isHov = hovered === "commons";
          return (
            <g
              style={{ cursor: "pointer", opacity: entered ? 1 : 0, transition: "opacity 0.8s ease 800ms" }}
              onMouseEnter={() => setHovered("commons")}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelectNode("commons")}
            >
              {/* Outer pulse ring */}
              <circle cx={x} cy={y} r={commonsRadius + 18}
                fill="none" stroke={C.commons} strokeWidth={0.8}
                strokeOpacity={isHov ? 0.3 : 0.12}
                strokeDasharray="2 6"
              />
              {/* Large halo */}
              <circle cx={x} cy={y} r={commonsRadius * 2.5}
                fill={C.commons} fillOpacity={isHov ? 0.10 : 0.05}
                style={{ transition: "fill-opacity 0.2s" }}
              />
              {/* Core */}
              <circle cx={x} cy={y} r={commonsRadius}
                fill={C.surface2} stroke={C.commons}
                strokeWidth={isHov ? 2.5 : 1.8}
                filter="url(#commons-glow)"
                style={{ transition: "stroke-width 0.15s" }}
              />
              {/* Inner dot */}
              <circle cx={x} cy={y} r={commonsRadius * 0.35}
                fill={C.commons} fillOpacity={isHov ? 1 : 0.9}
              />
            </g>
          );
        })()}
      </svg>

      {/* Node labels */}
      {TAXONOMY_NODES_SLIM.map((node, idx) => {
        const pos = NODE_POSITIONS[node.id];
        if (!pos) return null;
        const { x, y } = px(pos.x, pos.y);
        const lm = LOOP_META[node.loop];
        const isHov = hovered === node.id;
        const isCommons = node.id === "commons";
        const delay = idx * 50 + 300;

        const labelLeft = pos.x > 72 ? "auto" : pos.x < 28 ? 0 : "50%";
        const labelRight = pos.x > 72 ? 0 : "auto";
        const labelTransform = pos.x > 72 ? "none" : pos.x < 28 ? "none" : "translateX(-50%)";
        const labelTop = isCommons || pos.y < 25 ? "calc(100% + 12px)" : "auto";
        const labelBottom = !isCommons && pos.y >= 25 ? "calc(100% + 8px)" : "auto";

        return (
          <div key={`label-${node.id}`} style={{
            position: "absolute",
            left: x,
            top: y,
            pointerEvents: "none",
            opacity: entered ? 1 : 0,
            transition: `opacity 0.5s ease ${delay}ms`,
            zIndex: isCommons ? 10 : 1,
          }}>
            <div style={{
              position: "absolute",
              top: labelTop,
              bottom: labelBottom,
              left: labelLeft,
              right: labelRight,
              transform: labelTransform,
              whiteSpace: "nowrap",
              textAlign: pos.x > 72 ? "right" : pos.x < 28 ? "left" : "center",
            }}>
              <div style={{
                fontFamily: C.mono,
                fontSize: isCommons ? (w < 600 ? 10 : 12) : (w < 600 ? 8 : 10),
                color: isHov ? lm.color : isCommons ? lm.color + "cc" : C.textDim,
                fontWeight: isCommons ? 700 : isHov ? 700 : 400,
                letterSpacing: isCommons ? "0.08em" : "0.04em",
                lineHeight: 1.3,
                transition: "color 0.15s",
              }}>
                {node.icon} {node.label}
              </div>
              {isHov && (
                <div style={{
                  fontFamily: C.mono, fontSize: 9, color: C.textDimmer,
                  marginTop: 3, maxWidth: 180,
                  textAlign: "center",
                }}>
                  {lm.question}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Loop region labels */}
      {[
        { label: "Internal Technical Loop", x: 6, y: 82, color: C.internal },
        { label: "Handoff Zone", x: 36, y: 82, color: C.handoff },
        { label: "External Human Governance Loop", x: 55, y: 82, color: C.external },
        { label: "Governance Infrastructure", x: 36, y: 2, color: C.commons },
      ].map(({ label, x, y, color }) => (
        <div key={label} style={{
          position: "absolute",
          left: `${x}%`,
          top: `${y}%`,
          fontFamily: C.mono,
          fontSize: w < 600 ? 7 : 9,
          color,
          opacity: entered ? 0.4 : 0,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          pointerEvents: "none",
          whiteSpace: "nowrap",
          transition: "opacity 1s ease 1.2s",
        }}>
          {label}
        </div>
      ))}

      {/* Hover tooltip */}
      {hovered && (() => {
        const node = TAXONOMY_NODES_SLIM.find(n => n.id === hovered);
        const pos = NODE_POSITIONS[hovered];
        if (!node || !pos) return null;
        const { x, y } = px(pos.x, pos.y);
        const lm = LOOP_META[node.loop];
        const tipLeft = pos.x > 60 ? "auto" : x + 20;
        const tipRight = pos.x > 60 ? w - x + 20 : "auto";
        const tipTop = pos.y > 65 ? "auto" : y + 20;
        const tipBottom = pos.y > 65 ? h - y + 20 : "auto";

        return (
          <div style={{
            position: "absolute",
            left: tipLeft, right: tipRight,
            top: tipTop, bottom: tipBottom,
            background: C.surface2,
            border: `1px solid ${lm.color}50`,
            borderRadius: 6,
            padding: "10px 14px",
            pointerEvents: "none",
            zIndex: 20,
            maxWidth: 240,
            boxShadow: `0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px ${lm.color}20`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ color: lm.color, fontFamily: C.mono, fontSize: 14 }}>{node.icon}</span>
              <span style={{ color: C.text, fontFamily: C.mono, fontSize: 11, fontWeight: 700 }}>{node.label}</span>
            </div>
            <div style={{ fontFamily: C.mono, fontSize: 9, color: lm.color, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
              {lm.label}
            </div>
            <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.6, fontStyle: "italic", marginBottom: 8 }}>
              {lm.question}
            </div>
            <div style={{ fontFamily: C.mono, fontSize: 9, color: C.textDimmer }}>
              click to enter →
            </div>
          </div>
        );
      })()}
    </div>
  );
}
