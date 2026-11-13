// InterACCtive activity signals for graded labs.
//
// Counts how answers are entered between graded submissions: real key presses and clicks, values
// set by a script, text inserted without typing, pastes, time away from the page, and whether the
// browser says it is automated. The lab sends IACSignals.take() with each submit-step; the server
// adds its own timing and saves the result for the instructor. Nothing here changes a score, reads
// what the student types, or leaves this page except with a submission.
//
// Labs load it with <script src="/interacctive/integrity.js"></script> and call
//   IACSignals.reset()  when a graded attempt starts or resumes
//   IACSignals.take()   with each submission (returns the counts and starts a new count)
(function () {
  "use strict";
  if (window.IACSignals) return;
  var S, lastKey = 0;
  var now = function () { return (window.performance && performance.now) ? performance.now() : Date.now(); };
  function reset() {
    S = { keys: 0, ukeys: 0, uin: 0, uclk: 0, ptr: 0, nokey: 0, paste: 0, pchars: 0, drop: 0, away: 0, awayMs: 0, gaps: [] };
    S.awaySince = document.hidden || (document.hasFocus && !document.hasFocus()) ? now() : null;
    lastKey = 0;
  }
  reset();
  var CONTROL = "input,select,textarea,button,label,[role=radio],[role=button],[data-act]";
  var inLab = function (t) { return t && t.closest && !t.closest("dialog,.gdlg,#gDlg") && t.closest("main,#entry"); };
  var on = function (type, fn, target) { (target || document).addEventListener(type, fn, true); };

  on("keydown", function (e) {
    if (!inLab(e.target)) return;
    if (!e.isTrusted) { S.ukeys++; return; }
    S.keys++;
    var t = now();
    if (lastKey && t - lastKey < 2000 && S.gaps.length < 400) S.gaps.push(t - lastKey);
    lastKey = t;
  });
  on("input", function (e) {
    var t = e.target;
    if (!inLab(t) || !t.matches || !t.matches("input,select,textarea")) return;
    if (!e.isTrusted) { S.uin++; return; }
    var it = e.inputType || "";
    if ((it === "insertText" || it === "insertReplacementText") && now() - lastKey > 500) S.nokey++;
    if (it === "insertFromDrop") S.drop++;
  });
  on("change", function (e) {
    var t = e.target;
    if (inLab(t) && t.matches && t.matches("input,select,textarea") && !e.isTrusted) S.uin++;
  });
  on("click", function (e) {
    var t = e.target;
    if (!e.isTrusted && inLab(t) && t.closest && t.closest(CONTROL)) S.uclk++;
  });
  on("pointerdown", function (e) { if (e.isTrusted && inLab(e.target)) S.ptr++; });
  on("paste", function (e) {
    if (!inLab(e.target)) return;
    S.paste++;
    try { S.pchars += ((e.clipboardData && e.clipboardData.getData("text")) || "").length; } catch (_) { /* ignore */ }
  });
  function leave() { if (S.awaySince === null) { S.away++; S.awaySince = now(); } }
  function back() { if (S.awaySince !== null) { S.awayMs += now() - S.awaySince; S.awaySince = null; } }
  on("visibilitychange", function () { if (document.hidden) leave(); else if (!document.hasFocus || document.hasFocus()) back(); });
  on("blur", function (e) { if (e.target === window) leave(); }, window);
  on("focus", function (e) { if (e.target === window) back(); }, window);

  function take() {
    if (S.awaySince !== null && !document.hidden) back();
    var g = S.gaps.slice().sort(function (a, b) { return a - b; });
    var out = {
      keys: S.keys, ukeys: S.ukeys, uin: S.uin, uclk: S.uclk, ptr: S.ptr, nokey: S.nokey,
      paste: S.paste, pchars: S.pchars, drop: S.drop, away: S.away, awayMs: Math.round(S.awayMs),
      medKi: g.length ? Math.round(g[Math.floor(g.length / 2)]) : 0,
      wd: navigator.webdriver === true
    };
    var stillAway = S.awaySince !== null;
    reset();
    if (stillAway) S.awaySince = now();
    return out;
  }
  window.IACSignals = { take: take, reset: reset };
})();
