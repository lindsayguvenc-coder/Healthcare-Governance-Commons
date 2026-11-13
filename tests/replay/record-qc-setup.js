// Records a captioned replay of the Agent QC Setup prototype (Nov 12, 2026):
// the map, a few measures, live calculations and caveats, and the QC plan.
// Usage (server must be running, see server.js):
//   node server.js ../.. 3000 &
//   node record-qc-setup.js http://localhost:3000 ./video-qc [chromePath]
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
  await caption("Agent QC Setup · first slice · opens on the map");
  await go("#mapH");
  await caption("The nine measures. Chips say where each is set: here, in the Metric Picker, or not yet.", 3500);
  await go("#m-stab");
  await caption("Each measure: primary metric, lab equivalent, then set points with starting values and descriptors.", 3500);
  await page.locator('[data-k="stab.base"]').fill("10");
  await page.locator('[data-k="stab.base"]').dispatchEvent("input");
  await page.locator('[data-k="stab.base"]').scrollIntoViewIfNeeded();
  await caption("Change baseline runs to 10: the bound updates and a caveat appears, only because of that choice.", 3800);
  await page.locator('[data-k="stab.base"]').fill("20");
  await page.locator('[data-k="stab.base"]').dispatchEvent("input");
  await go("#m-sub");
  await caption("Commutability and subgroups. Minimum group size shows its interval live.", 3200);
  await page.locator('[data-k="sub.min"]').fill("10");
  await page.locator('[data-k="sub.min"]').dispatchEvent("input");
  await page.locator('[data-k="sub.min"]').scrollIntoViewIfNeeded();
  await caption("At 10 per group: 9 of 10 correct is consistent with 60% to 98%. Small-group caveat appears.", 3800);
  await page.locator("#m-sub details.teach summary").click();
  await page.locator("#m-sub details.teach").scrollIntoViewIfNeeded();
  await caption("Teachy layer stays closed until opened: the Del Monte fruit cup.", 3200);
  await go("#m-eqa");
  await caption("External quality assessment: says plainly there is nothing to configure yet.", 3000);
  await go("#m-ca");
  await caption("Corrective action and lookback: Knob 4, with today's starting values.", 3200);
  await go("#plan");
  await caption("The QC plan. * marks values still at their starting value, to confirm at validation.", 4000);
  await page.reload();
  await page.waitForTimeout(800);
  const kept = await page.locator('[data-k="sub.min"]').inputValue();
  await caption(`Reloaded: changes kept in this browser (group size still ${kept}).`, 2600);
  await caption(errors.length ? `Page errors: ${errors.join(" | ")}` : "Done. No page errors.", 2500);
  await browser.close();

  const list = path.join(out, "frames.txt");
  fs.writeFileSync(list, frames.map(f => `file '${f.shot}'\nduration ${f.sec}`).join("\n") + `\nfile '${frames[frames.length - 1].shot}'\n`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list,
    "-vf", "fps=10,format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", path.join(out, "qc-setup-replay.mp4")]);
  console.log(errors.length ? "ERRORS: " + errors.join(" | ") : "ok", path.join(out, "qc-setup-replay.mp4"));
})();
