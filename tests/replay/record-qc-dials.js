// Records a captioned replay of the three dials (consequence, closeness, exposure) in the Agent QC Setup (Nov 12, 2026).
// Usage (server must be running, see server.js):
//   node server.js ../.. 3000 &
//   node record-qc-dials.js http://localhost:3000 ./video-dials [chromePath]
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
  await top("#dials");
  await caption("New first step: three dials: consequence, closeness, exposure to change.", 3800);
  await page.locator("#dialSummary").scrollIntoViewIfNeeded();
  await caption("The triage example: harm possible, so all nine measures apply.", 3200);
  await top("#dials");
  await page.locator('input[name=d_cons][value=low]').check(); await page.waitForTimeout(500);
  await page.locator('input[name=d_close][value=exact]').check(); await page.waitForTimeout(500);
  await top("#dials");
  await caption("A low-stakes clinical tool (say, a scheduling helper): little consequence, but exact answers.", 4200);
  await page.locator("#dialSummary").scrollIntoViewIfNeeded();
  await caption("Six measures apply. Subgroups, escalation and external assessment are optional, shown closed.", 4000);
  await top("#map");
  await caption("The map marks the optional ones.", 2800);
  await top("#m-stab");
  await caption("Monitoring stays close: daily controls (exposure) and 95% agreement across repeats (exactness).", 4000);
  await top("#m-ca");
  await caption("Governance gets light: warn and log, the owner releases, fewer set points.", 3800);
  await top("#plan");
  await caption("The plan opens with the stakes, and lists what was optional and not set.", 4000);
  await caption(errors.length ? `Page errors: ${errors.join(" | ")}` : "Done. No page errors.", 2500);
  await browser.close();
  const list = path.join(out, "frames.txt");
  fs.writeFileSync(list, frames.map(f => `file '${f.shot}'\nduration ${f.sec}`).join("\n") + `\nfile '${frames[frames.length - 1].shot}'\n`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-vf", "fps=10,format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", path.join(out, "qc-dials-replay.mp4")]);
  console.log(errors.length ? "ERRORS: " + errors.join(" | ") : "ok", path.join(out, "qc-dials-replay.mp4"));
})();
