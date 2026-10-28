// Patient-information guard for every Commons page with free-text fields.
// A screen for obvious slips, not de-identification.
//  1. Puts a plain note under each free-text box.
//  2. Checks a box when you leave it and warns right there.
//  3. Before anything is sent, checks what you typed: clear identifiers are
//     stopped in your browser and never sent; possible ones ask you first.
// The server runs the strong checks again (api/_phi.js).
(function () {
  var MONTH = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
  var DATE = "(?:\\d{1,2}[\\/\\-.]\\d{1,2}[\\/\\-.]\\d{2,4}|" + MONTH + "\\.?\\s+\\d{1,2},?\\s+\\d{4}|\\d{1,2}\\s+" + MONTH + "\\.?\\s+\\d{4})";
  var STRONG = [
    [/\b\d{3}-\d{2}-\d{4}\b/, "a Social Security number"],
    [/\b(MRN|medical record(?: number| no\.?)?|record no\.?|patient id|pt id)[:\s#]*[A-Z]?\d{4,}/i, "a medical record number"],
    [new RegExp("\\b(DOB|D\\.O\\.B\\.|date of birth|birth ?date|born(?: on)?)[:\\s]*" + DATE, "i"), "a date of birth"],
    [/\b(?:[Pp]atient|[Pp]t|[Ss]ubject|[Nn]ame)\s*[:\-]\s*[A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+/, "a patient name"],
    [/\b(accession|acc\.?|specimen id|case no\.?)[:\s#]*[A-Z0-9-]{6,}/i, "an accession or specimen number"],
    [/\b\d{1,5}\s+(?:[A-Z][a-z]+\s){1,3}(Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl)\b\.?/, "a street address"]
  ];
  var WEAK = [
    [/[\w.+-]+@[\w-]+\.[\w.]+/, "an email address"],
    [/\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/, "a phone number"],
    [new RegExp("\\b" + DATE + "\\b", "i"), "a specific date"],
    [/\b\d{9}\b/, "a nine-digit number"],
    [/\b(9\d|1[01]\d)[\s-]?(?:year|yr)s?[\s-]?old\b|\bage[:\s]+(9\d|1[01]\d)\b/i, "an age over 89"],
    [/\b(Mr|Mrs|Ms|Miss)\.?\s+[A-Z][a-z]+/, "a person's name"]
  ];
  function check(text, list) { for (var i = 0; i < list.length; i++) if (list[i][0].test(text)) return list[i][1]; return null; }
  function isFreeText(el) {
    if (el.tagName === "TEXTAREA") return true;
    if (el.tagName !== "INPUT") return false;
    var t = (el.getAttribute("type") || "text").toLowerCase();
    return t === "text" || t === "search";
  }
  var NOTE = "Don't enter patient information. These tools don't need it.";
  function addNote(el) {
    if (el.tagName !== "TEXTAREA" || el.dataset.phiNote) return;
    el.dataset.phiNote = "1";
    var n = document.createElement("div");
    n.className = "phi-note";
    n.style.cssText = "font:12px/1.4 system-ui,sans-serif;opacity:.75;margin-top:4px";
    n.textContent = NOTE;
    if (el.parentNode) el.parentNode.insertBefore(n, el.nextSibling);
  }
  function warnAt(el, why, strong) {
    var w = el.nextSibling && el.nextSibling.className === "phi-note" ? el.nextSibling : null;
    if (!w) { w = document.createElement("div"); w.className = "phi-note"; el.parentNode && el.parentNode.insertBefore(w, el.nextSibling); }
    w.style.cssText = "font:600 12px/1.4 system-ui,sans-serif;margin-top:4px;color:" + (strong ? "#c0392b" : "#a8701a");
    w.textContent = strong
      ? "This looks like " + why + ". Remove it: these tools don't need patient information, and it won't be sent."
      : "This might be " + why + ". If it's about a patient, remove it.";
  }
  function clearWarn(el) {
    var w = el.nextSibling;
    if (w && w.className === "phi-note") { w.style.cssText = "font:12px/1.4 system-ui,sans-serif;opacity:.75;margin-top:4px"; w.textContent = NOTE; }
  }
  function scan(root) { (root.querySelectorAll ? root.querySelectorAll("textarea") : []).forEach(addNote); }
  document.addEventListener("focusout", function (e) {
    var el = e.target; if (!el || !isFreeText(el)) return;
    var s = check(el.value, STRONG); if (s) return warnAt(el, s, true);
    var w = check(el.value, WEAK); if (w) return warnAt(el, w, false);
    clearWarn(el);
  }, true);
  function typedText() {
    var out = [];
    document.querySelectorAll("textarea, input").forEach(function (el) { if (isFreeText(el) && el.value) out.push(el.value); });
    return out.join("\n");
  }
  var realFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      var method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
      var path = url.replace(location.origin, "");
      if (method === "POST" && path.indexOf("/api/") === 0 && path.indexOf("/api/status") !== 0) {
        var text = typedText();
        var s = check(text, STRONG);
        if (s) {
          var msg = "This looks like it includes " + s + ". These tools don't need patient information, so remove it and try again. Nothing was sent.";
          try { window.alert(msg); } catch (e) {}
          return Promise.resolve(new Response(JSON.stringify({ error: msg, phi: true }), { status: 400, headers: { "Content-Type": "application/json" } }));
        }
        var w = check(text, WEAK);
        if (w && !window.confirm("What you typed might include " + w + ". If it's about a patient, cancel and remove it. Send anyway?")) {
          return Promise.resolve(new Response(JSON.stringify({ error: "Not sent. Remove patient details and try again.", phi: true }), { status: 400, headers: { "Content-Type": "application/json" } }));
        }
      }
    } catch (e) {}
    return realFetch.apply(this, arguments);
  };
  function start() {
    scan(document);
    new MutationObserver(function (ms) { ms.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) { if (n.tagName === "TEXTAREA") addNote(n); else scan(n); } }); }); })
      .observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
