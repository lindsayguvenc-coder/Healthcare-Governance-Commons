// Records a captioned replay of Knob 1 (metrics) and the folded-in calculators in the Agent QC Setup (Nov 12, 2026).
// Usage (server must be running, see server.js):
//   node server.js ../.. 3000 &
//   node record-qc-knob1.js http://localhost:3000 ./video-knob1 [chromePath]
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const base = process.argv[2], out = path.resolve(process.argv[3]), exe = process.argv[4];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errors = []; page.on("pageerror", e => errors.push(e.message));
  const frames = [];
  const caption = async (text, ms = 2800) => {
    await page.evaluate(t => { let el = document.getElementById("__cap"); if (!el) { el = document.createElement("div"); el.id = "__cap";
      el.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:99999;padding:14px 22px;background:rgba(10,12,20,.94);color:#f5f0ff;font:600 17px/1.4 system-ui,sans-serif;border-top:2px solid #a78bfa"; document.body.appendChild(el); } el.textContent = t; }, text);
    const shot = path.join(out, `frame-${String(frames.length).padStart(3, "0")}.png`); await page.screenshot({ path: shot }); frames.push({ shot, sec: ms / 1000 });
  };
  const top = async sel => { await page.evaluate(s => document.querySelector(s).scrollIntoView({ block: "start" }), sel); await page.waitForTimeout(300); };
  await page.goto(`${base}/qc-setup/`); await page.waitForTimeout(1200);
  await top("#knob1");
  await caption("Knob 1: what one run produces. Triage is the default example: a choice from a set.", 3600);
  await top("#m-stab");
  await caption("Performance stability now shows one default accuracy and one precision metric for that output type.", 3800);
  await page.locator('[data-metric="accuracy"]').selectOption("1");
  await top("#m-stab");
  await caption("'Choose instead' swaps the metric. It doesn't add one.", 3200);
  await page.locator('[data-metric="accuracy"]').selectOption("0");
  await top("#m-chg");
  await caption("Change detection: one change metric, and the old picker's calculators folded in, closed.", 3600);
  await page.locator("#m-chg details.calcbox > summary").click(); await page.waitForTimeout(1200);
  await top("#calcWhy");
  await caption("Opened: it says why these calculators fit, and shows only those. Count limits first.", 4000);
  await page.locator("#cTiles").scrollIntoViewIfNeeded();
  await caption("Drift sensors, since triage has items with no agreed answer. Other calculators sit closed below.", 4000);
  await top("#knob1");
  await page.locator('[data-ex="note"]').click(); await page.waitForTimeout(600);
  await caption("Switch to the discharge-summary example: output type becomes a grade.", 3200);
  await top("#m-grader");
  await caption("Grader reliability now has a grader to check. For triage it said no grader was needed.", 3600);
  await top("#m-ae");
  await page.locator("#m-ae details.calcbox > summary").click(); await page.waitForTimeout(600);
  await page.locator("#sgOut").scrollIntoViewIfNeeded();
  await caption("Allowable error gets the sigma calculator, since grades are charted like numbers.", 3600);
  await top("#m-chg"); await page.locator("#m-chg details.calcbox > summary").click(); await page.waitForTimeout(5000);
  await top("#calcMain");
  await caption("Change detection now leads with Levey-Jennings rules, simulated live.", 3800);
  await top("#plan");
  await caption("The plan opens with Knob 1: output type, chosen metrics, and the rule settings.", 4000);
  await caption(errors.length ? `Page errors: ${errors.join(" | ")}` : "Done. No page errors.", 2500);
  await browser.close();
  const list = path.join(out, "frames.txt");
  fs.writeFileSync(list, frames.map(f => `file '${f.shot}'\nduration ${f.sec}`).join("\n") + `\nfile '${frames[frames.length - 1].shot}'\n`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-vf", "fps=10,format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", path.join(out, "qc-knob1-replay.mp4")]);
  console.log(errors.length ? "ERRORS: " + errors.join(" | ") : "ok", path.join(out, "qc-knob1-replay.mp4"));
})();
