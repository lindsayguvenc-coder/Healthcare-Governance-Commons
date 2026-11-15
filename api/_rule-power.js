// api/_rule-power.js — exact error-detection math for the protocol's QC rules.
// Underscore prefix: Vercel does not expose this as a route.
// CommonJS on purpose: api/package.json declares "type": "commonjs".
//
// For a rule set and a window of W control runs, this works out:
//   - Pfr: how often the rules reject with no error present (false rejection)
//   - Ped: how often they catch a shift of 1 or 2 SD within the window
// It is calculated, not simulated: no random numbers, so the same rules always
// give the same answer, and the answer comes from the rules the protocol
// actually turns on, not from a separate copy of them.
//
// Method: control results are independent normal z-scores. Walk the W runs one
// at a time, carrying the probability that nothing has fired yet, as a density
// over the previous result (a fine grid on z) and the current same-side run
// length (for 10x). Each step keeps only the next results that fire no rule.
// Grid step 0.002 SD: the result is good to about 1 in 10,000.
//
// Only rules it knows how to calculate are allowed. Any other active reject rule
// makes it refuse (throws), so a new rule can never be left out silently.
// tests: scripts/check.mjs cross-checks it against a seeded simulation that
// uses firesOn() below, the same rule definitions in plain form.

const SUPPORTED = new Set(["1-3s", "2-2s", "R-4s", "10x"]);

// Plain-form rules: does this sequence of z-scores fire any of the given rules?
function firesOn(ids, zs) {
  const has = new Set(ids);
  let run = 0;
  for (let i = 0; i < zs.length; i++) {
    const z = zs[i], p = i ? zs[i - 1] : null;
    run = p !== null && Math.sign(z) === Math.sign(p) ? run + 1 : 1;
    if (has.has("1-3s") && Math.abs(z) > 3) return true;
    if (has.has("2-2s") && p !== null && ((z > 2 && p > 2) || (z < -2 && p < -2))) return true;
    if (has.has("R-4s") && p !== null && z * p < 0 && Math.abs(z - p) > 4) return true;
    if (has.has("10x") && run >= 10) return true;
  }
  return false;
}

const SQRT2PI = Math.sqrt(2 * Math.PI);
const phi = (x) => Math.exp(-0.5 * x * x) / SQRT2PI;

// Probability that the rules fire at least once within W runs, with every
// result shifted by `shift` SD.
function fireProbability(ids, shift, W = 10, h = 0.002) {
  for (const id of ids) if (!SUPPORTED.has(id)) throw new Error(`No exact calculation for rule ${id}`);
  const has = new Set(ids);
  const L = -9 + Math.min(0, shift), U = 9 + Math.max(0, shift);
  const n = Math.round((U - L) / h);
  const z = new Float64Array(n), w = new Float64Array(n);
  for (let k = 0; k < n; k++) { z[k] = L + (k + 0.5) * h; w[k] = phi(z[k] - shift) * h; }
  const R = has.has("10x") ? 10 : 2; // run-length states 1..R-1 (10x fires at 10)
  const ok1 = (zz) => !(has.has("1-3s") && Math.abs(zz) > 3);

  // mass[r][k]: P(no fire so far, last result at z[k], same-side run length r)
  let mass = Array.from({ length: R }, () => new Float64Array(n));
  for (let k = 0; k < n; k++) if (ok1(z[k])) mass[1][k] = w[k];

  for (let step = 1; step < W; step++) {
    const next = Array.from({ length: R }, () => new Float64Array(n));
    for (let r = 1; r < R; r++) {
      // prefix sums of mass over previous z, for range queries
      const pre = new Float64Array(n + 1);
      for (let k = 0; k < n; k++) pre[k + 1] = pre[k] + mass[r][k];
      const sum = (lo, hi) => { // total mass with previous z in [lo, hi)
        const a = Math.max(0, Math.min(n, Math.ceil((lo - L) / h - 0.5)));
        const b = Math.max(0, Math.min(n, Math.ceil((hi - L) / h - 0.5)));
        return b > a ? pre[b] - pre[a] : 0;
      };
      for (let k = 0; k < n; k++) {
        const zz = z[k];
        if (!ok1(zz)) continue;
        let same, opp; // allowed previous mass on the same side and the other side
        if (zz > 0) {
          same = sum(0, (has.has("2-2s") && zz > 2) ? 2 : Infinity);
          opp = sum(has.has("R-4s") ? zz - 4 : -Infinity, 0);
        } else {
          same = sum((has.has("2-2s") && zz < -2) ? -2 : -Infinity, 0);
          opp = sum(0, has.has("R-4s") ? zz + 4 : Infinity);
        }
        const rs = r + 1; // run length if this result stays on the same side
        if (R === 2) next[1][k] += w[k] * (same + opp);
        else {
          if (rs < R) next[rs][k] += w[k] * same; // rs === R would be 10x: fired, dropped
          next[1][k] += w[k] * opp;
        }
      }
    }
    mass = next;
  }
  let survive = 0;
  for (const m of mass) for (let k = 0; k < n; k++) survive += m[k];
  return 1 - survive;
}

// The reject rules that apply to z-scores, from the protocol's own rule list.
function zRejectRules(rules) {
  return rules.filter((r) => r.active && r.tier === "reject" && r.id && r.id !== "fail-count").map((r) => r.id);
}

module.exports = { fireProbability, firesOn, zRejectRules, SUPPORTED };
