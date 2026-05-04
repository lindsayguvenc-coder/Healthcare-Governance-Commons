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

// Node positions as percentages of the canvas — laid out to suggest the dual-loop architecture
// Internal loop nodes cluster left-center, external right-center, handoff nodes bridge the middle
// Commons floats above, separate
const NODE_POSITIONS = {
  // Internal technical loop — left cluster
  norm:             { x: 18, y: 42 },
  watcher:          { x: 28, y: 28 },
  // Handoff zone — bridge in center
  h1:               { x: 44, y: 22 },
  h2:               { x: 44, y: 58 },
  h3:               { x: 38, y: 40 },
  h4:               { x: 50, y: 40 },
  // External human loop — right cluster
  escalation:       { x: 62, y: 22 },
  adjudicate:       { x: 72, y: 35 },
  threshold_review: { x: 68, y: 52 },
  authority:        { x: 60, y: 62 },
  stop:             { x: 80, y: 55 },
  override:         { x: 82, y: 38 },
  validation:       { x: 74, y: 68 },
  // Commons — elevated, separate
  commons:          { x: 50, y: 10 },
};

// Connections to draw between related nodes — implied structure
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
  ["commons", "h2"],
  ["commons", "authority"],
  ["commons", "watcher"],
];

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

  const nodeRadius = Math.max(6, Math.min(10, w / 80));

  return (
    <div ref={containerRef} style={{
      position: "relative",
      width: "100%",
      height: "100%",
      background: C.bg,
      overflow: "hidden",
      cursor: "default",
    }}>
      {/* Ambient glow regions — implied loops */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
        <defs>
          <radialGradient id="glow-internal" cx="25%" cy="38%" r="28%">
            <stop offset="0%" stopColor={C.internal} stopOpacity="0.04"/>
            <stop offset="100%" stopColor={C.internal} stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="glow-external" cx="72%" cy="48%" r="32%">
            <stop offset="0%" stopColor={C.external} stopOpacity="0.04"/>
            <stop offset="100%" stopColor={C.external} stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="glow-commons" cx="50%" cy="10%" r="20%">
            <stop offset="0%" stopColor={C.commons} stopOpacity="0.06"/>
            <stop offset="100%" stopColor={C.commons} stopOpacity="0"/>
          </radialGradient>
          <filter id="node-glow">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Ambient loop regions */}
        <rect width="100%" height="100%" fill="url(#glow-internal)"/>
        <rect width="100%" height="100%" fill="url(#glow-external)"/>
        <rect width="100%" height="100%" fill="url(#glow-commons)"/>

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
          const colorA = LOOP_META[nodeA?.loop]?.color || C.textDimmer;
          const colorB = LOOP_META[nodeB?.loop]?.color || C.textDimmer;
          const gradId = `conn-${i}`;
          return (
            <g key={`conn-${a}-${b}`}>
              <defs>
                <linearGradient id={gradId} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor={colorA} stopOpacity={isHovered ? 0.4 : 0.12}/>
                  <stop offset="100%" stopColor={colorB} stopOpacity={isHovered ? 0.4 : 0.12}/>
                </linearGradient>
              </defs>
              <line
                x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                stroke={`url(#${gradId})`}
                strokeWidth={isHovered ? 1.5 : 0.8}
                style={{ transition: "stroke-width 0.2s, opacity 0.2s" }}
              />
            </g>
          );
        })}

        {/* Nodes */}
        {TAXONOMY_NODES_SLIM.map((node, idx) => {
          const pos = NODE_POSITIONS[node.id];
          if (!pos) return null;
          const { x, y } = px(pos.x, pos.y);
          const lm = LOOP_META[node.loop];
          const isHov = hovered === node.id;
          const r = node.id === "commons" ? nodeRadius * 1.4 : nodeRadius;
          const delay = idx * 60;

          return (
            <g
              key={node.id}
              style={{
                cursor: "pointer",
                opacity: entered ? 1 : 0,
                transform: entered ? "none" : "scale(0.8)",
                transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
                transformOrigin: `${x}px ${y}px`,
              }}
              onMouseEnter={() => setHovered(node.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelectNode(node.id)}
            >
              {/* Outer glow ring on hover */}
              {isHov && (
                <circle cx={x} cy={y} r={r + 10}
                  fill="none"
                  stroke={lm.color}
                  strokeWidth={1}
                  strokeOpacity={0.3}
                  style={{ animation: "pulse 1.5s ease infinite" }}
                />
              )}
              {/* Halo */}
              <circle cx={x} cy={y} r={r * 2.5}
                fill={lm.color}
                fillOpacity={isHov ? 0.12 : 0.05}
                style={{ transition: "fill-opacity 0.2s" }}
              />
              {/* Core node */}
              <circle
                cx={x} cy={y} r={r}
                fill={C.surface2}
                stroke={lm.color}
                strokeWidth={isHov ? 2 : 1.2}
                filter="url(#node-glow)"
                style={{ transition: "stroke-width 0.15s, r 0.15s" }}
              />
              {/* Inner dot */}
              <circle cx={x} cy={y} r={r * 0.35}
                fill={lm.color}
                fillOpacity={isHov ? 1 : 0.7}
                style={{ transition: "fill-opacity 0.2s" }}
              />
              {/* Optional: not mandatory marker */}
              {!node.mandatory && (
                <circle cx={x + r * 0.8} cy={y - r * 0.8} r={2.5}
                  fill={C.textDimmer}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Node labels — HTML overlays for crisp text */}
      {TAXONOMY_NODES_SLIM.map((node, idx) => {
        const pos = NODE_POSITIONS[node.id];
        if (!pos) return null;
        const { x, y } = px(pos.x, pos.y);
        const lm = LOOP_META[node.loop];
        const isHov = hovered === node.id;
        const delay = idx * 60 + 200;

        // Label positioning — keep labels from going off-edge
        const labelLeft = pos.x > 75 ? "auto" : pos.x < 25 ? 0 : "50%";
        const labelRight = pos.x > 75 ? 0 : "auto";
        const labelTransform = pos.x > 75 ? "none" : pos.x < 25 ? "none" : "translateX(-50%)";
        const labelTop = pos.y < 20 ? "calc(100% + 10px)" : "auto";
        const labelBottom = pos.y >= 20 ? "calc(100% + 8px)" : "auto";

        return (
          <div
            key={`label-${node.id}`}
            style={{
              position: "absolute",
              left: x,
              top: y,
              pointerEvents: "none",
              opacity: entered ? 1 : 0,
              transition: `opacity 0.5s ease ${delay}ms`,
            }}
          >
            <div style={{
              position: "absolute",
              top: labelTop,
              bottom: labelBottom,
              left: labelLeft,
              right: labelRight,
              transform: labelTransform,
              whiteSpace: "nowrap",
              textAlign: pos.x > 75 ? "right" : pos.x < 25 ? "left" : "center",
            }}>
              <div style={{
                fontFamily: C.mono,
                fontSize: w < 600 ? 8 : 10,
                color: isHov ? lm.color : C.textDim,
                fontWeight: isHov ? 700 : 400,
                letterSpacing: "0.04em",
                lineHeight: 1.3,
                transition: "color 0.15s",
              }}>
                {node.icon} {node.label}
              </div>
              {isHov && (
                <div style={{
                  fontFamily: C.mono,
                  fontSize: 9,
                  color: C.textDimmer,
                  marginTop: 2,
                  maxWidth: 160,
                }}>
                  {LOOP_META[node.loop].label}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Loop region labels — subtle, ambient */}
      {[
        { label: "Internal Technical Loop", x: 8, y: 18, color: C.internal },
        { label: "Handoff Zone", x: 38, y: 88, color: C.handoff },
        { label: "External Human Governance Loop", x: 52, y: 88, color: C.external },
        { label: "Governance Commons", x: 42, y: 2, color: C.commons },
      ].map(({ label, x, y, color }) => (
        <div key={label} style={{
          position: "absolute",
          left: `${x}%`,
          top: `${y}%`,
          fontFamily: C.mono,
          fontSize: w < 600 ? 7 : 9,
          color: color,
          opacity: 0.35,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          pointerEvents: "none",
          whiteSpace: "nowrap",
          transition: "opacity 1s ease 1s",
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
        const tipTop = pos.y > 70 ? "auto" : y + 20;
        const tipBottom = pos.y > 70 ? h - y + 20 : "auto";

        return (
          <div style={{
            position: "absolute",
            left: tipLeft,
            right: tipRight,
            top: tipTop,
            bottom: tipBottom,
            background: C.surface2,
            border: `1px solid ${lm.color}40`,
            borderRadius: 6,
            padding: "10px 14px",
            pointerEvents: "none",
            zIndex: 10,
            maxWidth: 240,
            boxShadow: `0 4px 24px rgba(0,0,0,0.4)`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ color: lm.color, fontFamily: C.mono, fontSize: 14 }}>{node.icon}</span>
              <span style={{ color: C.text, fontFamily: C.mono, fontSize: 11, fontWeight: 700 }}>{node.label}</span>
            </div>
            <div style={{ fontFamily: C.mono, fontSize: 9, color: lm.color, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
              {lm.label}
            </div>
            <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.6, fontStyle: "italic" }}>
              {lm.question}
            </div>
            <div style={{ marginTop: 8, fontFamily: C.mono, fontSize: 9, color: C.textDimmer }}>
              click to enter →
            </div>
          </div>
        );
      })()}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; r: ${nodeRadius + 10}; }
          50% { opacity: 0.5; r: ${nodeRadius + 14}; }
        }
      `}</style>
    </div>
  );
}
