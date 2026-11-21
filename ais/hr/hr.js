/* Ask HR: Company Policies (ACCT 2250 / ACCT 6641): a help desk where students ask Nora Feldman,
 * Trailhead's HR and Payroll Coordinator, about the Company Policies (the course syllabus).
 *
 * Open from Canvas: ais/hr/?course=<class id>
 * Conversations use the staff-chat server function (actions directory, start, send, transcript) with
 * bot "nora-feldman" and assignment tag "HR". The policy text and Nora's instructions live only on the
 * server. This page holds no card, template or syllabus text. Messages are shown as plain text, never as HTML.
 */
(function () {
  "use strict";
  var SB_URL = "https://yoijetxcolixkjqsxkpo.supabase.co", SB_KEY = "sb_publishable_R7CQN_jmNSlHZiGvXa9Jqw_bQv3q3fE";
  var BOT = "nora-feldman", GROUP = "hr", TAG = "HR";
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var q = new URLSearchParams(location.search);
  var COURSE = UUID.test(q.get("course") || "") ? q.get("course") : null;
  var $ = function (id) { return document.getElementById(id); };
  var SB = null, USER = null, DIR = null, CONVS = [], CUR = null, READY = false, BUSY = false, EMAIL = "";
  var NAME = "Nora Feldman", TITLE = "HR and Payroll Coordinator";

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
    try { DIR = await api({ action: "directory", course_id: COURSE, group: GROUP }); }
    catch (e) { status(""); if (e.code === "unauthorized") return showSignIn(e.message); alertMsg(e.message); return; }
    var bots = Array.isArray(DIR.bots) ? DIR.bots : [];
    var nora = bots.filter(function (b) { return b && b.id === BOT; })[0] || null;
    if (nora) { NAME = nora.name || NAME; TITLE = nora.title || TITLE; }
    // Only Nora's conversations, even if the server returns others.
    CONVS = (Array.isArray(DIR.conversations) ? DIR.conversations : []).filter(function (c) { return c && (c.bot === BOT || c.assignment === TAG); });
    READY = !!(DIR.ready && nora && nora.available);
    $("signin").hidden = true; $("app").hidden = false; alertMsg("");
    $("who").textContent = USER && USER.email ? USER.email : "";
    renderPast(); renderUsage(); setEnabled(); count();
    if (READY) status("HR help desk ready.");
    else { status(""); alertMsg("The HR help desk isn't switched on yet. Check back later. For a policy question now, read the syllabus in Canvas or ask Professor Goodwin."); }
    if (focusMsg && READY) $("msg").focus();
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
    var t = "Messages today, across all Trailhead chats: " + DIR.today + " of " + DIR.limits.per_day + ".";
    if (CUR) t += " This conversation: " + (CUR.student_messages || 0) + " of " + DIR.limits.per_conversation + ".";
    $("usage").textContent = t;
  }
  $("past").addEventListener("click", function (e) { var b = e.target.closest("button[data-conv]"); if (b) openConversation(b.dataset.conv); });

  // ---------- chat ----------
  function showChat(conv, messages) {
    CUR = conv;
    $("chatH").textContent = "Conversation with " + (conv.name || NAME);
    $("chatSub").textContent = "Started " + fmtDate(conv.started_at) + ", " + fmtTime(conv.started_at);
    var log = $("log"); log.textContent = "";
    messages.forEach(function (m) { log.appendChild(bubble(m.role, m.content, m.at)); });
    log.hidden = messages.length === 0;
    $("starters").hidden = messages.length > 0;
    log.scrollTop = log.scrollHeight;
    $("announce").textContent = "";
    renderPast(); renderUsage(); setEnabled(); count();
  }
  function clearChat() {
    CUR = null;
    $("chatH").textContent = "Ask " + first() + " a question"; $("chatSub").textContent = "";
    $("log").textContent = ""; $("log").hidden = true; $("starters").hidden = false; $("announce").textContent = "";
    renderPast(); renderUsage(); setEnabled();
  }
  function bubble(role, text, at) {
    var d = el("div", "sc-msg " + (role === "student" ? "me" : role === "staff" ? "staff" : "wait"));
    if (role !== "wait") d.appendChild(el("h3", "", (role === "student" ? "You" : NAME) + (at ? ", " + fmtTime(at) : "")));
    d.appendChild(el("p", "", text));
    return d;
  }
  // Starts a conversation with Nora, tagged HR. Returns true if it started.
  async function startConversation() {
    status("Starting a conversation with " + first() + "…");
    try {
      var r = await api({ action: "start", course_id: COURSE, bot: BOT, assignment: TAG });
      DIR.today = r.today; CONVS.unshift(r.conversation);
      showChat(r.conversation, []);
      return true;
    } catch (e) { status(""); if (e.code === "unauthorized") showSignIn(e.message); else alertMsg(e.message); return false; }
  }
  async function openConversation(id) {
    if (BUSY) return;
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
    $("msg").value = b.dataset.q; count(); send();
  });
  async function send() {
    if (BUSY || !READY) return;
    var text = $("msg").value.trim();
    if (!text) { alertMsg("Type a question first."); $("msg").focus(); return; }
    if (Array.from(text).length > maxChars()) { alertMsg("Keep each message to " + maxChars() + " characters or fewer."); $("msg").focus(); return; }
    BUSY = true; alertMsg("");
    $("send").disabled = true; $("send").setAttribute("aria-busy", "true");
    var log = $("log"), mine = null, wait = null;
    try {
      // The first question of a new conversation starts it, so an empty conversation is never saved.
      if (!CUR && !(await startConversation())) return;
      mine = bubble("student", text, new Date().toISOString()); wait = bubble("wait", first() + " is replying…");
      log.hidden = false; $("starters").hidden = true;
      log.appendChild(mine); log.appendChild(wait); log.scrollTop = log.scrollHeight;
      status(first() + " is replying…");
      var r = await api({ action: "send", conversation_id: CUR.id, message: text });
      log.removeChild(wait);
      log.appendChild(bubble("staff", r.reply, new Date().toISOString()));
      $("announce").textContent = NAME + " says: " + r.reply;
      log.scrollTop = log.scrollHeight;
      $("msg").value = ""; count();
      CUR.student_messages = r.student_messages; DIR.today = r.today;
      CONVS.forEach(function (c) { if (c.id === CUR.id) c.student_messages = r.student_messages; });
      renderPast(); renderUsage(); status("");
    } catch (e) {
      if (wait && wait.parentNode) log.removeChild(wait);
      if (mine && mine.parentNode) log.removeChild(mine);   // not saved; the text stays in the box to try again
      if (!log.children.length) { log.hidden = true; $("starters").hidden = false; }
      status("");
      if (e.code === "unauthorized") showSignIn(e.message);
      else if (e.code === "card_changed") { alertMsg(e.message + " Press Send again to ask in a new conversation."); clearChat(); }
      else alertMsg(e.message);
    } finally {
      BUSY = false; $("send").removeAttribute("aria-busy"); setEnabled();
      if (!$("app").hidden && READY) $("msg").focus();
    }
  }
  $("restart").addEventListener("click", function () {
    if (BUSY) return;
    clearChat(); alertMsg(""); status("New conversation. Type your question."); $("msg").focus();
  });

  // ---------- transcript download (plain text, built from the server's saved copy) ----------
  $("download").addEventListener("click", async function () {
    if (!CUR || BUSY) return;
    status("Preparing the transcript…");
    try {
      var t = await api({ action: "transcript", conversation_id: CUR.id });
      var c = t.conversation, who = c.name || NAME, lines = [
        "Trailhead HR help desk: Company Policies (simulation)",
        "ACCT 2250 / ACCT 6641 · Accounting Information Systems",
        "HR contact: " + who + ", " + (c.title || TITLE),
        "Student: " + (USER && USER.email ? USER.email : ""),
        "Started: " + new Date(c.started_at).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" }),
        "Conversation ID: " + c.id + " (card " + c.card_version + ")",
        "Nora is an AI chatbot playing a fictional employee and can be wrong. The syllabus is the final word.",
        ""];
      t.messages.forEach(function (m) { lines.push("[" + fmtTime(m.at) + "] " + (m.role === "student" ? "You" : who) + ": " + m.content, ""); });
      var blob = new Blob([lines.join("\r\n")], { type: "text/plain;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "trailhead-hr-" + BOT + "-" + c.started_at.slice(0, 10) + "-" + c.id.slice(0, 8) + ".txt";
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
