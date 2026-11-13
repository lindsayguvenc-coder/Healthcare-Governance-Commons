// Records a captioned replay of Knob 3 (lanes) in the Agent QC Setup (Nov 12, 2026).
// Usage (server must be running, see server.js):
//   node server.js ../.. 3000 &
//   node record-qc-lanes.js http://localhost:3000 ./video-lanes [chromePath]
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const base = process.argv[2];
const out = path.resolve(process.argv[3]);
const exe = process.argv[4];

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  const frames = [];
  const caption = async (text, ms = 2800) => {
    await page.evaluate(t => {
      let el = document.getElementById("__cap");
      if (!el) {
        el = document.createElement("div");
        el.id = "__cap";
        el.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:99999;padding:14px 22px;background:rgba(10,12,20,.94);color:#f5f0ff;font:600 17px/1.4 system-ui,sans-serif;border-top:2px solid #a78bfa";
        document.body.appendChild(el);
      }
      el.textContent = t;
    }, text);
    const shot = path.join(out, `frame-${String(frames.length).padStart(3, "0")}.png`);
    await page.screenshot({ path: shot });
    frames.push({ shot, sec: ms / 1000 });
  };
  const go = async sel => { await page.locator(sel).scrollIntoViewIfNeeded(); await page.evaluate(s => document.querySelector(s).scrollIntoView({ block: "start" }), sel); await page.waitForTimeout(300); };

  await page.goto(`${base}/qc-setup/`);
  await page.waitForTimeout(1200);
  await caption("Agent QC Setup · Knob 3, lanes · test run");
  await go("#m-ae");
  await caption("Allowable error and Escalation now point to lanes, set per control.", 3000);
  await go("#lanes");
  await caption("Lanes: the answer scale, most urgent first, and who approves the lanes.", 3200);
  await go("#ctrls");
  await caption("Each control: expected answer, the lane around it, and what happens on each side. Examples are labeled.", 4000);
  const pp = page.locator('.ctrl[data-i="1"]');
  await pp.scrollIntoViewIfNeeded();
  await pp.locator('select[data-f="behC"]').selectOption("None");
  await page.locator('.ctrl[data-i="1"] .caveat').last().scrollIntoViewIfNeeded();
  await caption("Postpartum control: set 'if the safety question is absent' to None, and a caveat appears.", 3800);
  await page.locator('.ctrl[data-i="1"] select[data-f="behC"]').selectOption("Reject");
  const fv = page.locator('.ctrl[data-i="2"]');
  await fv.locator('select[data-f="hi"]').selectOption("See within 24 hours");
  await page.locator('.ctrl[data-i="2"] select[data-f="lo"]').selectOption("See within 24 hours");
  await page.locator('.ctrl[data-i="2"] .caveat').last().scrollIntoViewIfNeeded();
  await caption("Fever control narrowed to one answer: single-answer lane caveat.", 3600);
  await page.locator('.ctrl[data-i="2"] select[data-f="slow"]').selectOption("Warn");
  await page.locator('.ctrl[data-i="2"] .caveat').last().scrollIntoViewIfNeeded();
  await caption("Undertriage set to warn only: a second caveat asks if that is deliberate.", 3600);
  await page.locator("#addCtrl").click();
  await page.locator('.ctrl').last().scrollIntoViewIfNeeded();
  await caption("Add a control: blank case, lane starts at one answer for clinicians to widen.", 3200);
  await go("#plan");
  await page.evaluate(() => { const p = document.getElementById("planText"); p.scrollTop = p.scrollHeight; });
  await caption("The plan now ends with Knob 3: every lane, with example controls flagged for replacement.", 4200);
  await page.reload(); await page.waitForTimeout(800);
  const n = await page.locator(".ctrl").count();
  await caption(`Reloaded: ${n} controls kept in this browser.`, 2600);
  await caption(errors.length ? `Page errors: ${errors.join(" | ")}` : "Done. No page errors.", 2500);
  await browser.close();

  const list = path.join(out, "frames.txt");
  fs.writeFileSync(list, frames.map(f => `file '${f.shot}'\nduration ${f.sec}`).join("\n") + `\nfile '${frames[frames.length - 1].shot}'\n`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list,
    "-vf", "fps=10,format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", path.join(out, "qc-lanes-replay.mp4")]);
  console.log(errors.length ? "ERRORS: " + errors.join(" | ") : "ok", path.join(out, "qc-lanes-replay.mp4"));
})();
