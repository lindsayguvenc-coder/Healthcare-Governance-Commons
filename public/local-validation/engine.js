// Local Validation Kit engine (Nov 13, 2026). Runs any rule pack. A pack is plain data:
// columns, a gate (all must hold), and criteria (any one is enough). Every condition is
// three-valued: true, false, or unknown (a blank field). Numeric cutoffs can carry a
// "near" margin; values inside it go to a person instead of being decided.
// Works in the browser (window.LVK) and in Node (module.exports), so tests use the same code.
(function (root) {
  const TRUE = ["1", "y", "yes", "true"], FALSE = ["0", "n", "no", "false"];
  function value(row, col) {
    const v = row[col];
    return v === undefined || v === null || String(v).trim() === "" ? null : String(v).trim();
  }
  function num(v) { const n = Number(v); return v !== null && Number.isFinite(n) ? n : null; }
  const OPS = { ">=": (a, b) => a >= b, ">": (a, b) => a > b, "<=": (a, b) => a <= b, "<": (a, b) => a < b, "==": (a, b) => a === b };
  const OP_WORDS = { ">=": "at least", ">": "over", "<=": "at most", "<": "under", "==": "exactly" };

  // Returns { v: true|false|null, near: bool, text: "what was found" }
  function evalCond(c, row) {
    if (c.any || c.all) {
      const parts = (c.any || c.all).map((x) => evalCond(x, row));
      const isAny = !!c.any;
      const hit = parts.filter((p) => p.v === true), miss = parts.filter((p) => p.v === false), unk = parts.filter((p) => p.v === null);
      let v;
      if (isAny) v = hit.length ? true : unk.length ? null : false;
      else v = miss.length ? false : unk.length ? null : true;
      // Near: the group's answer could flip with a small change in one part
      const near = isAny ? (v === true ? hit.length === 1 && hit[0].near : parts.some((p) => p.near))
        : (v === false ? miss.length === 1 && miss[0].near : parts.some((p) => p.near));
      // Found: the label. Blank: say which part is blank. Otherwise: what each part showed.
      const text = v === true && c.label ? c.label
        : (v === true ? hit : v === null ? unk : parts).map((p) => p.text).filter(Boolean).join(", ");
      return { v, near: !!near, text };
    }
    if (c.unless) {
      const inner = evalCond({ ...c, unless: undefined }, row);
      if (inner.v !== true) return inner;
      const u = evalCond(c.unless, row);
      if (u.v === true) return { v: false, near: false, text: "" };
      // Would be a hit but for a blank exception field: never decide this one by rule.
      if (u.v === null) return { v: null, near: false, critical: true, text: `${inner.text}, but ${c.unless.col.replace(/_/g, " ")} is blank` };
      return inner;
    }
    let x, name;
    if (c.ratio) {
      const a = num(value(row, c.ratio[0])), b = num(value(row, c.ratio[1]));
      x = a === null || b === null || b === 0 ? null : a / b;
      name = `${c.ratio[0]} / ${c.ratio[1]}`.replace(/_/g, " ");
    } else { x = value(row, c.col); name = (c.label || c.col).replace(/_/g, " "); }
    if (x === null) return { v: null, near: false, text: `${name} is blank` };
    if (c.is !== undefined) {
      const s = String(x).toLowerCase();
      const b = TRUE.includes(s) ? true : FALSE.includes(s) ? false : null;
      if (b === null) return { v: null, near: false, text: `${name} is "${x}"` };
      return { v: b === c.is, near: false, text: b === c.is ? name : "" };
    }
    const n = typeof x === "number" ? x : num(x);
    if (n === null) return { v: null, near: false, text: `${name} is "${x}"` };
    const v = OPS[c.op](n, c.value);
    const near = c.near ? Math.abs(n - c.value) <= Math.abs(c.value) * c.near : false;
    const shown = Math.round(n * 100) / 100;
    return { v, near, text: `${name} ${shown}` };
  }

  // One row -> { label: "yes" | "no" | "unsure", why: [...], check: [...] }
  function labelRow(pack, row) {
    const why = [], check = [];
    for (const g of pack.gate || []) {
      const r = evalCond(g, row);
      if (r.v === false && !r.near) return { label: "no", why: [g.failText || `Not met: ${describe(g)}`], check: [] };
      if (r.v === false && r.near) check.push(`${r.text} is just short of: ${describe(g)}`);
      else if (r.v === null) check.push(r.text || `Can't tell: ${describe(g)}`);
      else { why.push(r.text || describe(g)); if (r.near) check.push(`${r.text} is right at the cutoff`); }
    }
    if (check.length) return { label: "unsure", why, check };
    const res = (pack.criteria || []).map((c) => ({ c, r: evalCond(c, row) }));
    const hits = res.filter((x) => x.r.v === true);
    const unknown = res.filter((x) => x.r.v === null);
    const nearMiss = res.filter((x) => x.r.v === false && x.r.near);
    if (hits.length) {
      if (hits.length === 1 && hits[0].r.near) return { label: "unsure", why, check: [`the only criterion met, ${hits[0].r.text}, is right at its cutoff`] };
      return { label: "yes", why: why.concat(hits.map((h) => h.r.text || describe(h.c))), check: [] };
    }
    if (nearMiss.length) return { label: "unsure", why, check: nearMiss.map((x) => `${x.r.text} is just short of: ${describe(x.c)}`) };
    const critical = unknown.filter((x) => x.r.critical);
    if (critical.length) return { label: "unsure", why, check: critical.map((x) => x.r.text) };
    const maxBlank = pack.maxBlankCriteria === undefined ? 0 : pack.maxBlankCriteria;
    if (unknown.length > maxBlank) return { label: "unsure", why, check: unknown.map((x) => x.r.text || `Can't tell: ${describe(x.c)}`) };
    return { label: "no", why: why.concat([pack.noCriteriaText || "No criterion met"]), check: [] };
  }

  // Plain-English version of a condition, for the sign-off view
  function describe(c) {
    const inner = c.any ? "any of: " + c.any.map(describe).join("; or ") : c.all ? c.all.map(describe).join(", and ") : null;
    if (inner) return c.label ? `${c.label} (${inner})` : inner;
    let s;
    if (c.ratio) s = `${c.ratio[0]} ÷ ${c.ratio[1]} is ${OP_WORDS[c.op]} ${c.value}`;
    else if (c.is !== undefined) s = `${c.col} is ${c.is ? "yes" : "no"}`;
    else s = `${c.col} is ${OP_WORDS[c.op]} ${c.value}`;
    s = s.replace(/_/g, " ");
    if (c.near) s += ` (within ${Math.round(c.near * 100)}% of the cutoff goes to a person)`;
    if (c.unless) s += `, unless ${describe(c.unless)}`;
    return s;
  }

  function validatePack(p) {
    const errs = [];
    if (!p || typeof p !== "object") return ["Not a rule pack."];
    for (const k of ["id", "name", "columns", "gate", "criteria", "labels"]) if (!(k in p)) errs.push(`Missing "${k}".`);
    const cols = new Set((p.columns || []).map((c) => c.name));
    const walk = (c, where) => {
      if (c.any || c.all) return (c.any || c.all).forEach((x) => walk(x, where));
      if (c.unless) walk(c.unless, where);
      const used = c.ratio ? c.ratio : [c.col];
      for (const u of used) if (!cols.has(u)) errs.push(`${where} uses "${u}", which isn't in columns.`);
      if (!c.ratio && c.is === undefined && !OPS[c.op]) errs.push(`${where}: operator "${c.op}" isn't one of ${Object.keys(OPS).join(" ")}.`);
    };
    (p.gate || []).forEach((c) => walk(c, "gate"));
    (p.criteria || []).forEach((c) => walk(c, "criteria"));
    return errs;
  }

  // Wilson score interval, 95%
  function wilson(k, n) {
    if (!n) return null;
    const z = 1.96, p = k / n, d = 1 + z * z / n;
    const c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
    return [Math.max(0, c - h), Math.min(1, c + h)];
  }
  // Smallest audit that would show accuracy >= target, if the rules are right `expected` of the time
  function auditSize(target, expected, cap) {
    for (let n = 10; n <= Math.max(10, cap || 5000); n++) {
      if (wilson(Math.round(expected * n), n)[0] >= target) return n;
    }
    return null;
  }

  const api = { labelRow, describe, validatePack, wilson, auditSize, evalCond };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.LVK = api;
})(typeof window !== "undefined" ? window : globalThis);
