// InterACCtive branding for labs and games.
//
// When a page is opened for a class (?course=…), this asks the platform for that class's instructor
// branding (school name and two colors, set on the instructor's InterACCtive page) and applies it.
// With no class, or no branding set, the page keeps its default look: University of New Haven, navy and gold.
//
// Pages load it with <script src="/interacctive/brand.js"></script> at the end of <head>. It only
// overrides the pages' own color variables and replaces the school name, so layout never changes.
// The last branding seen for a class is remembered in this browser so later visits don't flash.
(function () {
  "use strict";
  if (window.IACBrand) return;
  var SB_URL = "https://yoijetxcolixkjqsxkpo.supabase.co";
  var SB_KEY = "sb_publishable_R7CQN_jmNSlHZiGvXa9Jqw_bQv3q3fE"; // public key, same as the pages use
  var DEFAULT_SCHOOL = "University of New Haven";
  var course = new URLSearchParams(location.search).get("course");
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var HEX = /^#[0-9a-f]{6}$/i;

  // ---- color math (WCAG relative luminance) ----
  function rgb(h) { return [1, 3, 5].map(function (i) { return parseInt(h.substr(i, 2), 16); }); }
  function hex(c) { return "#" + c.map(function (v) { return ("0" + Math.round(Math.max(0, Math.min(255, v))).toString(16)).slice(-2); }).join(""); }
  function mix(a, b, t) { var x = rgb(a), y = rgb(b); return hex(x.map(function (v, i) { return v + (y[i] - v) * t; })); } // t of b
  function lum(h) { return rgb(h).reduce(function (s, v, i) { var c = v / 255; c = c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); return s + c * [0.2126, 0.7152, 0.0722][i]; }, 0); }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function towards(a, b, bg, need) { for (var t = 0; t <= 1.0001; t += 0.05) { var c = mix(a, b, t); if (contrast(c, bg) >= need) return c; } return b; }
  function rgba(h, a) { var c = rgb(h); return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }

  // ---- valid branding: same rules the database enforces ----
  function usable(b) {
    return b && HEX.test(b.primary_color || "") && HEX.test(b.accent_color || "") &&
      contrast(b.primary_color, "#ffffff") >= 4.5 && contrast(b.accent_color, b.primary_color) >= 3 &&
      contrast(b.accent_color, "#111b2e") >= 4.5;
  }

  function css(P, A) {
    var DARK = "#0f1a2e";
    var inkA = towards(A, "#000000", "#ffffff", 4.5);  // accent dark enough for text on white
    var softA = mix(A, "#ffffff", 0.8);
    var lightP = towards(P, "#ffffff", DARK, 4.5);      // main color light enough for text on dark
    var light = [
      "--navy:" + P, "--brand:" + P, "--mast-bg:" + P, "--nrv:" + P, "--cogs:" + P,
      "--navy-dk:" + mix(P, "#000000", 0.35), "--brand-soft:" + mix(P, "#ffffff", 0.89), "--navy-tint:" + mix(P, "#ffffff", 0.91),
      "--mast-muted:" + mix(P, "#ffffff", 0.78),
      "--gold:" + A, "--allow:" + A, "--merch-solid:" + A, "--adj-solid:" + A, "--ei:" + A,
      "--gold-tint:" + mix(A, "#ffffff", 0.85), "--shown-bg:" + mix(A, "#ffffff", 0.85),
      "--est:" + inkA, "--gold-ink:" + inkA, "--merch:" + inkA, "--adj:" + inkA,
      "--est-soft:" + softA, "--gold-soft:" + softA, "--merch-soft:" + softA, "--adj-soft:" + softA,
      "--hl:" + mix(A, "#ffffff", 0.75), "--hl-ink:" + mix(A, "#000000", 0.78)
    ].join(";");
    var softDark = mix(A, "#000000", 0.82);
    var dark = [
      "--brand:" + lightP, "--nrv:" + lightP, "--mast-bg:" + mix(P, "#000000", 0.45),
      "--brand-soft:" + mix(P, DARK, 0.75), "--mast-muted:" + mix(P, "#ffffff", 0.72),
      "--allow:" + A, "--est:" + A, "--gold-ink:" + A, "--gk-ink:" + A, "--merch:" + A, "--adj:" + A,
      "--merch-solid:" + A, "--adj-solid:" + A, "--ei:" + A,
      "--est-soft:" + softDark, "--gold-soft:" + softDark, "--gk-soft:" + softDark, "--merch-soft:" + softDark, "--adj-soft:" + softDark,
      "--hl:" + rgba(A, 0.2), "--hl-ink:" + mix(A, "#ffffff", 0.5)
    ].join(";");
    var out = ":root{" + light + "}" +
      "@media (prefers-color-scheme:dark){:root:not([data-theme=\"light\"]){" + dark + "}}" +
      ":root[data-theme=\"dark\"]{" + dark + "}";
    // Header labels are small accent-colored text on the main color; use white when the accent is too close.
    if (contrast(A, P) < 4.5) out += ".eyebrow,.kicker,.setchip b{color:#ffffff !important}.setchip.graded{color:#ffffff !important}";
    return out;
  }

  var styleEl = null, school = null, observer = null;
  function setStyle(text) {
    if (!styleEl) { styleEl = document.createElement("style"); styleEl.id = "iac-brand"; }
    styleEl.textContent = text;
    (document.body || document.head).appendChild(styleEl); // last, so it overrides the page's own variables
  }
  function renameIn(root) {
    if (!school || school === DEFAULT_SCHOOL) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), n, hits = [];
    while ((n = w.nextNode())) if (n.nodeValue.indexOf(DEFAULT_SCHOOL) >= 0) hits.push(n);
    hits.forEach(function (t) { t.nodeValue = t.nodeValue.split(DEFAULT_SCHOOL).join(school); });
    if (document.title.indexOf(DEFAULT_SCHOOL) >= 0) document.title = document.title.split(DEFAULT_SCHOOL).join(school);
  }
  function apply(b) {
    if (!b) return;
    if (usable(b)) setStyle(css(b.primary_color.toLowerCase(), b.accent_color.toLowerCase()));
    var name = (b.institution || "").trim();
    if (name && name.length <= 80 && !/[<>]/.test(name)) {
      school = name;
      var go = function () {
        renameIn(document.body);
        if (!observer && window.MutationObserver) {
          observer = new MutationObserver(function (ms) { ms.forEach(function (m) { m.addedNodes.forEach(function (x) { if (x.nodeType === 1) renameIn(x); else if (x.nodeType === 3 && x.parentNode) renameIn(x.parentNode); }); }); });
          observer.observe(document.body, { childList: true, subtree: true });
        }
        if (styleEl) document.body.appendChild(styleEl);
      };
      if (document.body) go(); else document.addEventListener("DOMContentLoaded", go);
    } else if (styleEl && !document.body) {
      document.addEventListener("DOMContentLoaded", function () { document.body.appendChild(styleEl); });
    }
  }

  if (course && UUID.test(course)) {
    var KEY = "iac.brand." + course, cached = null;
    try { cached = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (_) { cached = null; }
    if (cached) apply(cached);
    fetch(SB_URL + "/rest/v1/rpc/course_branding", {
      method: "POST",
      headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ p_course: course })
    }).then(function (r) { return r.ok ? r.json() : null; }).then(function (rows) {
      var b = Array.isArray(rows) && rows.length ? rows[0] : { institution: null, primary_color: null, accent_color: null };
      try { localStorage.setItem(KEY, JSON.stringify(b)); } catch (_) { /* ignore */ }
      if (JSON.stringify(b) !== JSON.stringify(cached)) {
        if (cached && !usable(b) && styleEl) styleEl.textContent = "";            // branding was removed
        if (cached && school && !(b.institution || "").trim()) location.reload();  // name removed: start clean
        else apply(b);
      }
    }).catch(function () { /* keep the default look */ });
  }
  window.IACBrand = { contrast: contrast, usable: usable, css: css };
})();
