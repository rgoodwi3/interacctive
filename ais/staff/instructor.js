/* Staff interview transcripts, instructor export (ACCT 2250). Reads public.staff_chat_transcripts(), which
 * returns rows only to the class instructor. Builds a CSV of every message and a plain-text file of transcripts. */
(function () {
  "use strict";
  var SB_URL = "https://yoijetxcolixkjqsxkpo.supabase.co", SB_KEY = "sb_publishable_R7CQN_jmNSlHZiGvXa9Jqw_bQv3q3fE";
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var COURSE = UUID.test(new URLSearchParams(location.search).get("course") || "") ? new URLSearchParams(location.search).get("course") : null;
  var $ = function (id) { return document.getElementById(id); };
  var SB = null, EMAIL = "", ROWS = [], LABEL = "all";
  function sb() { if (!SB) SB = window.supabase.createClient(SB_URL, SB_KEY); return SB; }
  function status(t) { $("status").textContent = t || ""; }
  function alertMsg(t) { $("alert").textContent = t || ""; $("alert").hidden = !t; }
  function el(tag, text) { var e = document.createElement(tag); e.textContent = text; return e; }

  $("emailForm").addEventListener("submit", async function (e) {
    e.preventDefault(); EMAIL = ($("email").value || "").trim(); alertMsg("");
    var r = await sb().auth.signInWithOtp({ email: EMAIL, options: { shouldCreateUser: false, emailRedirectTo: location.href.split("#")[0] } });
    if (r.error) return alertMsg(r.error.message);
    $("emailForm").hidden = true; $("codeForm").hidden = false; status("Code sent to " + EMAIL + "."); $("code").focus();
  });
  $("codeForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    var r = await sb().auth.verifyOtp({ email: EMAIL, token: ($("code").value || "").replace(/\s/g, ""), type: "email" });
    if (r.error) return alertMsg("That code didn't work. Check it, or send a new one.");
    ready(r.data.user);
  });
  function ready(user) { $("signin").hidden = true; $("app").hidden = false; $("who").textContent = user.email || ""; $("fAsg").focus(); }

  $("filters").addEventListener("submit", async function (e) {
    e.preventDefault(); alertMsg(""); status("Loading…");
    var asg = $("fAsg").value || null, from = $("fFrom").value, to = $("fTo").value;
    // Dates are midnight Eastern (EST; close enough for D1/D2/M1 windows, which fall before DST starts Mar 14).
    var args = { p_course: COURSE, p_assignment: asg, p_persona: null,
      p_from: from ? from + "T00:00:00-05:00" : null, p_to: to ? to + "T00:00:00-05:00" : null };
    var r = await sb().rpc("staff_chat_transcripts", args);
    if (r.error) { status(""); return alertMsg(r.error.message); }
    ROWS = r.data || []; LABEL = (asg || "all") + (from ? "-from-" + from : "") + (to ? "-to-" + to : "");
    render(); status(ROWS.length + " messages loaded.");
  });

  function groups() {
    var conv = new Map();
    ROWS.forEach(function (m) {
      if (!conv.has(m.conversation_id)) conv.set(m.conversation_id, { meta: m, msgs: [] });
      conv.get(m.conversation_id).msgs.push(m);
    });
    return conv;
  }
  function render() {
    var conv = groups(), byPair = new Map();
    conv.forEach(function (c) {
      var k = (c.meta.student_name || c.meta.student_email || c.meta.student_id) + "\u0000" + c.meta.persona_name;
      if (!byPair.has(k)) byPair.set(k, { student: c.meta.student_name || c.meta.student_email || c.meta.student_id, staff: c.meta.persona_name, n: 0, q: 0, v: new Set() });
      var p = byPair.get(k); p.n++; p.q += c.msgs.filter(function (m) { return m.role === "student"; }).length; p.v.add(c.meta.card_version);
    });
    var tb = $("rows"); tb.textContent = "";
    byPair.forEach(function (p) {
      var tr = document.createElement("tr");
      [p.student, p.staff, String(p.n), String(p.q), Array.from(p.v).join(", ")].forEach(function (t) { tr.appendChild(el("td", t)); });
      tb.appendChild(tr);
    });
    var tokens = ROWS.reduce(function (t, m) { return t + (m.input_tokens || 0) + (m.output_tokens || 0); }, 0);
    $("summary").textContent = conv.size + " conversations, " + ROWS.filter(function (m) { return m.role === "student"; }).length + " student questions, " + tokens.toLocaleString("en-US") + " model tokens.";
    $("out").hidden = false;
  }
  function download(name, text, type) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: type }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    status("Downloaded " + name + ".");
  }
  var COLS = ["conversation_id", "student_name", "student_email", "persona_name", "assignment", "card_version", "shared_version", "prompt_sha256", "model",
    "started_at", "seq", "role", "content", "created_at", "input_tokens", "output_tokens"];
  function cell(v) {
    var s = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;   // keep spreadsheet formulas from running
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  $("csv").addEventListener("click", function () {
    var lines = [COLS.join(",")].concat(ROWS.map(function (m) { return COLS.map(function (k) { return cell(m[k]); }).join(","); }));
    download("staff-transcripts-" + LABEL + ".csv", "\ufeff" + lines.join("\r\n"), "text/csv;charset=utf-8");
  });
  $("txt").addEventListener("click", function () {
    var out = [];
    groups().forEach(function (c) {
      var m0 = c.meta;
      out.push("==== " + (m0.student_name || "") + " <" + (m0.student_email || "") + "> with " + m0.persona_name + " · " + (m0.assignment || "untagged") +
        " · started " + m0.started_at + " · card " + m0.card_version + ", shared " + m0.shared_version + " · " + m0.conversation_id, "");
      c.msgs.forEach(function (m) { out.push("[" + m.created_at + "] " + (m.role === "student" ? "Student" : m0.persona_name) + ": " + m.content, ""); });
    });
    download("staff-transcripts-" + LABEL + ".txt", out.join("\r\n"), "text/plain;charset=utf-8");
  });

  window.addEventListener("load", async function () {
    if (!COURSE) return alertMsg("Add ?course=<class id> to this page's address.");
    var r = await sb().auth.getSession();
    if (r.data && r.data.session) ready(r.data.session.user); else { $("signin").hidden = false; $("email").focus(); }
  }, { once: true });
})();
