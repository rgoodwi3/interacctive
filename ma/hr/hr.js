/* Ask HR: Company Policies (ACCT 1102): the help desk where students ask Nora Feldman (HR Manager,
 * Problem Solvers Inc.) about the Company Policies, that is, the course syllabus.
 *
 * Open from Canvas: ma/hr/?course=<class id>
 * Conversations use the staff-chat server function (actions directory, start, send, transcript) with
 * persona "nora-feldman-1102" and assignment tag "HR", plus the "faq" action: saved answers from HR, approved by the
 * instructor, returned by id with no model call. If the server sends no saved-answer list, or the faq action
 * isn't available, a question button sends the question to Nora instead. The policy text, Nora's
 * instructions and the saved answers live only on the server. This page holds no card, template or syllabus text. Messages are shown as plain text, never as HTML.
 *
 * Course scope: this persona belongs to ACCT 1102 (Canvas course 46803). Every request that names a class also
 * sends canvas_course_id "46803" so the server can refuse a class from another course with a clear error. The
 * server decides the scope from the class itself and never trusts this value alone. The page also ignores any
 * persona or conversation the server returns for another persona (for example the help desk of another course).
 */
(function () {
  "use strict";
  var SB_URL = "https://yoijetxcolixkjqsxkpo.supabase.co", SB_KEY = "sb_publishable_R7CQN_jmNSlHZiGvXa9Jqw_bQv3q3fE";
  var BOT = "nora-feldman-1102", GROUP = "hr", TAG = "HR", CANVAS_COURSE = "46803";
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var q = new URLSearchParams(location.search);
  var COURSE = UUID.test(q.get("course") || "") ? q.get("course") : null;
  var $ = function (id) { return document.getElementById(id); };
  var SB = null, USER = null, DIR = null, CONVS = [], CUR = null, READY = false, BUSY = false, EMAIL = "";
  var FAQ = [], FAQ_ON = false, MAX_MORE = 6;
  // Errors that mean "no saved answer here": fall back to asking Nora. The first three mean the server has no faq action.
  var NO_FAQ_ACTION = ["bad_action", "unknown_action", "bad_request"], FAQ_MISS = ["faq_not_found", "faq_stale", "faq_unavailable"];
  var NAME = "Nora Feldman", TITLE = "HR Manager";

  // The avatar is optional: if the picture is missing, hide it rather than show a broken image.
  var av = $("avatar");
  if (av) av.addEventListener("error", function () { av.hidden = true; }, { once: true });

  function sb() {
    if (!SB) {
      if (!window.supabase || !window.supabase.createClient) throw Object.assign(new Error("The sign-in service didn't load. Check your connection and reload the page."), { code: "sdk" });
      SB = window.supabase.createClient(SB_URL, SB_KEY);
    }
    return SB;
  }
  function status(t) { $("status").textContent = t || ""; }
  function alertMsg(t) { var a = $("alert"); a.textContent = t || ""; a.hidden = !t; }

  // Calls the staff-chat function as the signed-in user. Throws an Error with .code and a message to show.
  async function api(body) {
    var res, generic = "Could not reach the HR help desk. Check your connection and try again.";
    try { res = await sb().functions.invoke("staff-chat", { body: body }); }
    catch (e) { if (e && e.code === "sdk") throw e; throw Object.assign(new Error(generic), { code: "network" }); }
    if (!res.error) return res.data;
    var msg = generic, code = "network";
    try {
      var c = res.error.context;
      if (c && typeof c.json === "function") {
        var j = await c.json(); if (j && j.message) msg = j.message; if (j && j.error) code = String(j.error);
        if (c.status === 401) { code = "unauthorized"; msg = "Your sign-in has expired. Sign in again to keep going."; }
      }
    } catch (e) { /* keep the generic message */ }
    throw Object.assign(new Error(msg), { code: code });
  }

  function fmtTime(iso) { return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }
  function fmtDate(iso) { return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function first() { return NAME.split(" ")[0]; }
  // Exact match after normalizing case, spaces and end punctuation (the same rule as the server's typed-question match).
  function norm(t) { return String(t || "").toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, " ").trim().replace(/[\s?.!]+$/, ""); }

  // ---------- sign-in (email code, as the InterACCtive labs and the staff directory) ----------
  function showSignIn(msg) {
    $("app").hidden = true; $("signin").hidden = false;
    $("emailForm").hidden = false; $("codeForm").hidden = true;
    if (msg) alertMsg(msg);
    $("email").focus();
  }
  $("emailForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    var email = ($("email").value || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { alertMsg("Enter your email address."); $("email").focus(); return; }
    alertMsg(""); status("Sending the code…");
    try {
      var r = await sb().auth.signInWithOtp({ email: email, options: { shouldCreateUser: false, emailRedirectTo: location.href.split("#")[0] } });
      if (r.error) throw new Error(/signups? not allowed|not found/i.test(r.error.message) ? "There is no account for that email. Join your class on the course page first." : r.error.message);
      EMAIL = email; $("codeSent").textContent = "We sent a sign-in email to " + email + ". Enter the code from it here.";
      $("emailForm").hidden = true; $("codeForm").hidden = false; status("Code sent."); $("code").focus();
    } catch (x) { status(""); alertMsg(x.message); }
  });
  $("codeForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    var token = ($("code").value || "").replace(/\s/g, "");
    if (!token) { alertMsg("Enter the code from the email."); $("code").focus(); return; }
    alertMsg(""); status("Signing in…");
    try {
      var r = await sb().auth.verifyOtp({ email: EMAIL, token: token, type: "email" });
      if (r.error) throw new Error("That code didn't work. Check it, or send a new one.");
      USER = r.data.user; await loadDirectory(true);
    } catch (x) { status(""); alertMsg(x.message); }
  });
  $("otherEmail").addEventListener("click", function () { $("codeForm").hidden = true; $("emailForm").hidden = false; $("email").focus(); });
  $("signout").addEventListener("click", async function () {
    try { await sb().auth.signOut(); } catch (e) { /* ignore */ }
    USER = null; DIR = null; CUR = null; CONVS = []; showSignIn(); status("Signed out.");
  });

  // ---------- help desk state (from the directory action, HR group only) ----------
  async function loadDirectory(focusMsg) {
    status("Loading the HR help desk…");
    try { DIR = await api({ action: "directory", course_id: COURSE, canvas_course_id: CANVAS_COURSE, group: GROUP }); }
    catch (e) { status(""); if (e.code === "unauthorized") return showSignIn(e.message); alertMsg(e.message); return; }
    var bots = Array.isArray(DIR.bots) ? DIR.bots : [];
    var nora = bots.filter(function (b) { return b && b.id === BOT; })[0] || null;
    if (nora) { NAME = nora.name || NAME; TITLE = nora.title || TITLE; }
    // Only this Nora's conversations, even if the server returns others. Matched by persona id only: the
    // other course help desk uses the same "HR" tag, so the tag alone is not enough.
    CONVS = (Array.isArray(DIR.conversations) ? DIR.conversations : []).filter(function (c) { return c && c.bot === BOT; });
    READY = !!(DIR.ready && nora && nora.available);
    FAQ = (Array.isArray(DIR.faq) ? DIR.faq : []).filter(function (f) { return f && typeof f.id === "string" && typeof f.question === "string" && f.question; });
    FAQ_ON = FAQ.length > 0;
    renderFaq();
    $("signin").hidden = true; $("app").hidden = false; alertMsg("");
    $("who").textContent = USER && USER.email ? USER.email : "";
    renderPast(); renderUsage(); setEnabled(); count();
    if (READY) status("HR help desk ready.");
    else if (DIR.ready && !nora) { status(""); alertMsg("The HR help desk isn't available for this class. Open it from the link in your ACCT 1102 Canvas course. For a policy question now, read the syllabus in Canvas or ask Professor Goodwin."); }
    else { status(""); alertMsg("The HR help desk isn't switched on yet. Check back later. For a policy question now, read the syllabus in Canvas or ask Professor Goodwin."); }
    if (focusMsg && READY) $("msg").focus();
  }
  // Starter buttons whose question matches a saved answer use it; the other saved answers are listed after them.
  function renderFaq() {
    var used = {};
    document.querySelectorAll("#starterList button").forEach(function (b) {
      var hit = FAQ_ON ? FAQ.filter(function (f) { return norm(f.question) === norm(b.dataset.q) || (f.alternates || []).some(function (a) { return norm(a) === norm(b.dataset.q); }); })[0] : null;
      if (hit) { b.dataset.faq = hit.id; used[hit.id] = 1; } else delete b.dataset.faq;
    });
    var ul = $("faqList"); ul.textContent = "";
    var more = FAQ_ON ? FAQ.filter(function (f) { return !used[f.id]; }).slice(0, MAX_MORE) : [];
    more.forEach(function (f) {
      var li = el("li"), b = el("button", "btn", f.question);
      b.type = "button"; b.dataset.q = f.question; b.dataset.faq = f.id;
      li.appendChild(b); ul.appendChild(li);
    });
    ul.hidden = more.length === 0;
    $("startHint").textContent = FAQ_ON ? "Choose one for a saved answer from HR, or type your own question below." : "Choose one to ask it now, or type your own below.";
  }
  function setEnabled() {
    var off = !READY;
    $("msg").disabled = off; $("send").disabled = off; $("restart").disabled = off;
    document.querySelectorAll("#starters button").forEach(function (b) { b.disabled = off; });
    $("download").disabled = !CUR;
  }
  function renderPast() {
    var ul = $("past"); ul.textContent = "";
    $("pastNone").hidden = CONVS.length > 0;
    CONVS.forEach(function (c) {
      var li = el("li"), btn = el("button", "sc-conv");
      btn.type = "button"; btn.dataset.conv = c.id;
      btn.appendChild(el("b", "", fmtDate(c.started_at) + ", " + fmtTime(c.started_at)));
      var n = c.student_messages || 0, meta = n + (n === 1 ? " question" : " questions");
      btn.appendChild(el("span", "", meta));
      btn.setAttribute("aria-label", "Open conversation from " + fmtDate(c.started_at) + ", " + fmtTime(c.started_at) + ", " + meta);
      if (CUR && CUR.id === c.id) btn.setAttribute("aria-current", "true");
      li.appendChild(btn); ul.appendChild(li);
    });
  }
  function renderUsage() {
    if (!DIR || !DIR.limits) { $("usage").textContent = ""; return; }
    var t = "Messages today: " + DIR.today + " of " + DIR.limits.per_day + ".";
    if (CUR) t += " This conversation: " + (CUR.student_messages || 0) + " of " + DIR.limits.per_conversation + ".";
    $("usage").textContent = t;
    // Nora's own daily limit (spec 4j), shown only when the server sends it.
    var nu = $("noraUsage"), used = DIR.persona_used, lim = DIR.persona_limit;
    if (typeof used === "number" && typeof lim === "number") { nu.textContent = "Questions to " + first() + " today: " + Math.min(used, lim) + " of " + lim + "."; nu.hidden = false; }
    else { nu.textContent = ""; nu.hidden = true; }
  }
  $("past").addEventListener("click", function (e) { var b = e.target.closest("button[data-conv]"); if (b) openConversation(b.dataset.conv); });

  // ---------- chat ----------
  function showChat(conv, messages) {
    CUR = conv;
    $("chatH").textContent = "Conversation with " + (conv.name || NAME);
    $("chatSub").textContent = "Started " + fmtDate(conv.started_at) + ", " + fmtTime(conv.started_at);
    var log = $("log"); log.textContent = "";
    messages.forEach(function (m) { log.appendChild(bubble(m.source === "faq" ? "faq" : m.role, m.content, m.at, m.section)); });
    log.hidden = messages.length === 0;
    log.scrollTop = log.scrollHeight;
    $("announce").textContent = "";
    renderPast(); renderUsage(); setEnabled(); count();
  }
  function clearChat() {
    CUR = null;
    $("chatH").textContent = "Ask " + first() + " a question"; $("chatSub").textContent = "";
    $("log").textContent = ""; $("log").hidden = true; $("announce").textContent = "";
    renderPast(); renderUsage(); setEnabled();
  }
  // role: student, staff (Nora's reply), faq (a saved answer from HR) or wait.
  function bubble(role, text, at, section) {
    var d = el("div", "sc-msg " + (role === "student" ? "me" : role === "staff" ? "staff" : role === "faq" ? "staff faq" : "wait"));
    var who = role === "student" ? "You" : role === "faq" ? NAME + ", saved answer from HR" : NAME;
    if (role !== "wait") d.appendChild(el("h3", "", who + (at ? ", " + fmtTime(at) : "")));
    d.appendChild(el("p", "", text));
    if (role === "faq" && section) d.appendChild(el("p", "hr-src", "Section: " + section));
    return d;
  }
  function showReply(r, box) {
    var isFaq = r.source === "faq";
    box = box || $("log");
    box.appendChild(bubble(isFaq ? "faq" : "staff", r.reply, new Date().toISOString(), r.section));
    $("announce").textContent = isFaq ? "Saved answer from HR" + (r.section ? ", section " + r.section : "") + ": " + r.reply : NAME + " says: " + r.reply;
    box.scrollTop = box.scrollHeight;
  }
  // Starts a conversation with Nora, tagged HR. Returns true if it started.
  async function startConversation() {
    status("Starting a conversation with " + first() + "…");
    try {
      var r = await api({ action: "start", course_id: COURSE, canvas_course_id: CANVAS_COURSE, bot: BOT, assignment: TAG });
      DIR.today = r.today; CONVS.unshift(r.conversation);
      showChat(r.conversation, []);
      return true;
    } catch (e) { status(""); if (e.code === "unauthorized") showSignIn(e.message); else alertMsg(e.message); return false; }
  }
  async function openConversation(id) {
    if (BUSY) return;
    closeConfirm(false);
    BUSY = true; alertMsg(""); status("Opening the conversation…");
    try { var t = await api({ action: "transcript", conversation_id: id }); showChat(t.conversation, t.messages); status("Conversation opened."); $("chatH").focus(); }
    catch (e) { status(""); if (e.code === "unauthorized") showSignIn(e.message); else alertMsg(e.message); }
    finally { BUSY = false; }
  }
  function maxChars() { return DIR && DIR.limits ? DIR.limits.max_chars : 600; }
  function count() {
    var n = Array.from($("msg").value).length, max = maxChars();
    $("msgCount").textContent = n + " of " + max + " characters";
    $("msgCount").classList.toggle("over", n > max);
  }
  $("msg").addEventListener("input", count);
  $("msg").addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); $("ask").requestSubmit ? $("ask").requestSubmit() : send(); }
  });
  $("ask").addEventListener("submit", function (e) { e.preventDefault(); send(); });
  $("starters").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-q]");
    if (!b || b.disabled || BUSY) return;
    if (FAQ_ON && b.dataset.faq) askFaq(b.dataset.faq, b.dataset.q);
    else { $("msg").value = b.dataset.q; count(); send(b); }
  });

  // ---------- confirm before a new chat opens (inline, not a browser dialog) ----------
  var PENDING = null;
  function askConfirm(from, onYes) {
    PENDING = { from: from, onYes: onYes };
    $("confirmH").textContent = "Start a new chat with " + NAME + ", " + TITLE + "?";
    $("confirmP").textContent = "This starts a new saved conversation with HR. You can download its transcript at any time.";
    $("confirm").hidden = false; alertMsg("");
    $("confirmH").focus();
  }
  function closeConfirm(back) {
    var p = PENDING; PENDING = null; $("confirm").hidden = true;
    if (back && p && p.from && document.body.contains(p.from) && !p.from.disabled) p.from.focus();
    return p;
  }
  $("confirmYes").addEventListener("click", function () { var p = closeConfirm(false); if (p) p.onYes(); });
  $("confirmNo").addEventListener("click", function () { closeConfirm(true); });
  $("confirm").addEventListener("keydown", function (e) { if (e.key === "Escape") { e.preventDefault(); closeConfirm(true); } });

  // A saved answer: no model call and no new conversation. With a conversation open, it is saved in it;
  // otherwise it shows above the chat and is logged without a conversation. Falls back to asking Nora.
  async function askFaq(id, question) {
    if (BUSY || !READY) return;
    closeConfirm(false);
    BUSY = true; alertMsg("");
    var box = CUR ? $("log") : $("saved"), mine = null, fallback = false;
    try {
      mine = bubble("student", question, new Date().toISOString());
      box.hidden = false; box.appendChild(mine);
      status("Finding the saved answer…");
      var body = { action: "faq", course_id: COURSE, canvas_course_id: CANVAS_COURSE, bot: BOT, id: id };
      if (CUR) body.conversation_id = CUR.id;
      var r = await api(body);
      var f = r.entry || {};
      showReply({ source: "faq", reply: f.answer, section: f.section }, box);
      if (typeof r.today === "number") DIR.today = r.today;
      renderPast(); renderUsage(); status("");
    } catch (e) {
      if (mine && mine.parentNode) box.removeChild(mine);
      if (!box.children.length) box.hidden = true;
      status("");
      if (NO_FAQ_ACTION.indexOf(e.code) >= 0 || FAQ_MISS.indexOf(e.code) >= 0) {
        if (NO_FAQ_ACTION.indexOf(e.code) >= 0) { FAQ_ON = false; renderFaq(); }
        fallback = true;
      } else if (e.code === "unauthorized") showSignIn(e.message);
      else alertMsg(e.message);
    } finally {
      BUSY = false; setEnabled();
    }
    if (fallback) { $("msg").value = question; count(); send(); }
    else if (!$("app").hidden && READY) $("msg").focus();
  }
  // from: the control that asked, so Cancel can return focus to it (default: the question box).
  function send(from) {
    if (BUSY || !READY) return;
    var text = $("msg").value.trim();
    if (!text) { alertMsg("Type a question first."); $("msg").focus(); return; }
    if (Array.from(text).length > maxChars()) { alertMsg("Keep each message to " + maxChars() + " characters or fewer."); $("msg").focus(); return; }
    if (!CUR) { askConfirm(from && from.nodeType === 1 ? from : $("msg"), function () { deliver(text); }); return; }
    return deliver(text);
  }
  async function deliver(text) {
    if (BUSY) return;
    BUSY = true; alertMsg("");
    $("send").disabled = true; $("send").setAttribute("aria-busy", "true");
    var log = $("log"), mine = null, wait = null;
    try {
      if (!CUR && !(await startConversation())) return;
      mine = bubble("student", text, new Date().toISOString()); wait = bubble("wait", first() + " is replying…");
      log.hidden = false;
      log.appendChild(mine); log.appendChild(wait); log.scrollTop = log.scrollHeight;
      status(first() + " is replying…");
      var r = await api({ action: "send", conversation_id: CUR.id, message: text });
      log.removeChild(wait);
      showReply(r);   // r.source "faq": the server matched the typed question to a saved answer
      $("msg").value = ""; count();
      CUR.student_messages = r.student_messages; DIR.today = r.today;
      if (typeof r.persona_used === "number") DIR.persona_used = r.persona_used;
      CONVS.forEach(function (c) { if (c.id === CUR.id) c.student_messages = r.student_messages; });
      renderPast(); renderUsage(); status("");
    } catch (e) {
      if (wait && wait.parentNode) log.removeChild(wait);
      if (mine && mine.parentNode) log.removeChild(mine);   // not saved; the text stays in the box to try again
      if (!log.children.length) log.hidden = true;
      status("");
      if (e.code === "unauthorized") showSignIn(e.message);
      else if (e.code === "persona_day_limit") {
        // Nora's daily limit: show the server's message; saved answers keep working; the question stays in the box.
        alertMsg(e.message || "You've reached today's limit for questions to " + first() + ". Saved answers still work, and the limit resets at midnight. If you're in crisis, call CAPS at 203-932-7333, or 911 in an emergency.");
        if (typeof DIR.persona_limit === "number") DIR.persona_used = DIR.persona_limit;
        renderUsage();
      }
      else if (e.code === "card_changed") { alertMsg(e.message + " Press Send again to start a new conversation."); clearChat(); }
      else alertMsg(e.message);
    } finally {
      BUSY = false; $("send").removeAttribute("aria-busy"); setEnabled();
      if (!$("app").hidden && READY) $("msg").focus();
    }
  }
  $("restart").addEventListener("click", function () {
    if (BUSY || !READY) return;
    askConfirm($("restart"), async function () {
      BUSY = true; clearChat(); alertMsg("");
      try { if (await startConversation()) { status("New conversation started. Type your question."); } }
      finally { BUSY = false; setEnabled(); if (READY && !$("app").hidden) $("msg").focus(); }
    });
  });

  // ---------- transcript download (plain text, built from the server's saved copy) ----------
  $("download").addEventListener("click", async function () {
    if (!CUR || BUSY) return;
    status("Preparing the transcript…");
    try {
      var t = await api({ action: "transcript", conversation_id: CUR.id });
      var c = t.conversation, who = c.name || NAME, lines = [
        "Problem Solvers HR help desk: Company Policies (simulation)",
        "ACCT 1102 · Introduction to Managerial Accounting",
        "HR contact: " + who + ", " + (c.title || TITLE),
        "Student: " + (USER && USER.email ? USER.email : ""),
        "Started: " + new Date(c.started_at).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" }),
        "Conversation ID: " + c.id + " (card " + c.card_version + ")",
        "Nora is an AI chatbot playing a fictional employee and can be wrong. Saved answers from HR were written ahead of time. The syllabus is the final word.",
        ""];
      t.messages.forEach(function (m) {
        var label = m.role === "student" ? "You" : m.source === "faq" ? who + " (saved answer from HR" + (m.section ? "; section: " + m.section : "") + ")" : who;
        lines.push("[" + fmtTime(m.at) + "] " + label + ": " + m.content, "");
      });
      var blob = new Blob([lines.join("\r\n")], { type: "text/plain;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "problem-solvers-hr-" + BOT + "-" + c.started_at.slice(0, 10) + "-" + c.id.slice(0, 8) + ".txt";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      status("Transcript downloaded: " + a.download);
    } catch (e) { status(""); if (e.code === "unauthorized") showSignIn(e.message); else alertMsg(e.message); }
  });

  // ---------- start ----------
  async function init() {
    count();
    if (!COURSE) { alertMsg("Open the HR help desk from the link in Canvas. This link doesn't say which class you're in."); return; }
    try {
      var r = await sb().auth.getSession();
      USER = r.data && r.data.session ? r.data.session.user : null;
    } catch (e) { alertMsg(e.message); return; }
    if (USER) loadDirectory(false); else showSignIn();
  }
  if (document.readyState === "complete") init(); else window.addEventListener("load", init, { once: true });
})();
