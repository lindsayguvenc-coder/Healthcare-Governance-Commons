# GovernanceCommons.jsx — Constellation Map Patch

Three changes to make in GovernanceCommons.jsx:

---

## 1. Add import at the very top (after the existing `import { useState, useEffect, useRef } from "react";`)

```js
import ConstellationMap from "./ConstellationMap";
```

---

## 2. Change the default activeLayer state (around line 5 of the main app function)

FROM:
```js
const [activeLayer, setActiveLayer] = useState("taxonomy");
```

TO:
```js
const [activeLayer, setActiveLayer] = useState("home");
```

---

## 3. Add the home tab to BOTH the desktop nav array and the mobile drawer array

Find this array (appears twice — once for desktop, once for mobile drawer):
```js
{ id: "docs",     label: "① Doc Repository" },
{ id: "taxonomy", label: "② Taxonomy Navigator" },
{ id: "matrix",   label: "③ Commons Matrix" },
{ id: "intake",   label: "④ Add Document" },
```

Change to (in BOTH places):
```js
{ id: "home",     label: "◉ Map" },
{ id: "docs",     label: "① Doc Repository" },
{ id: "taxonomy", label: "② Taxonomy Navigator" },
{ id: "matrix",   label: "③ Commons Matrix" },
{ id: "intake",   label: "④ Add Document" },
```

---

## 4. Add the home render case in the Body section

Find this line in the {/* Body */} section:
```jsx
{activeLayer === "docs" && (
```

ADD this block immediately BEFORE it:
```jsx
{activeLayer === "home" && (
  <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
    <div style={{ padding: "20px 32px 12px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
      <div style={{ fontFamily: C.serif, fontSize: 28, fontWeight: 400, color: C.text, marginBottom: 4 }}>
        Clinical AI Governance Infrastructure
      </div>
      <div style={{ fontFamily: C.mono, fontSize: 11, color: C.textDimmer, letterSpacing: "0.08em" }}>
        Select a node to explore the governance architecture — each one leads to its knowledge base, evidence, and tools.
      </div>
    </div>
    <div style={{ flex: 1, minHeight: 0 }}>
      <ConstellationMap onSelectNode={(id) => {
        window.location.href = `/nodes/${id}`;
      }} />
    </div>
  </div>
)}
```

---

Both files go in `src/` alongside `GovernanceCommons.jsx` and `main.jsx`.
