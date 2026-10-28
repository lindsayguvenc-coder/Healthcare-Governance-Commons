// Report pause switch. When REPORTS_PAUSED=1 is set in Vercel, this page's
// report generation stops and a notice explains why. The questions still work.
(function () {
  var ENTRY = ["handleGeneratePDF", "goToGenerate", "startGeneration",
               "runUnpacker", "runContainerCheck", "runCharterBuilder"];
  var MSG = "Report generation is paused while this tool is reviewed. The questions still work, so you can read through them.";
  function notice() {
    if (document.getElementById("report-paused-note")) return document.getElementById("report-paused-note");
    var d = document.createElement("div");
    d.id = "report-paused-note"; d.setAttribute("role", "status");
    d.style.cssText = "font:600 14px/1.5 system-ui,sans-serif;padding:12px max(16px,env(safe-area-inset-left,0px));text-align:center;background:#eef0fb;color:#2b2d5c;border-bottom:1px solid #c9cdee";
    d.textContent = MSG;
    var first = document.querySelector('[role="note"]');
    if (first && first.parentNode) first.parentNode.insertBefore(d, first.nextSibling);
    else document.body.insertBefore(d, document.body.firstChild);
    return d;
  }
  function pause() {
    notice();
    ENTRY.forEach(function (name) {
      if (typeof window[name] === "function") {
        window[name] = function () { var n = notice(); n.scrollIntoView({ behavior: "smooth", block: "start" }); return false; };
      }
    });
  }
  fetch("/api/status", { cache: "no-store" })
    .then(function (r) { return r.ok ? r.json() : {}; })
    .then(function (s) { if (s && s.reportsPaused) pause(); })
    .catch(function () {});
})();
