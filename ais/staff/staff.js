/* Trailhead staff directory (ACCT 2250 / ACCT 6641): students interview the order-to-cash staff chatbots.
 *
 * Open from Canvas: ais/staff/?course=<class id>&for=D1   (for = D1, D2 or M1; optional, tags the conversation)
 * Everything about the staff (names, titles, replies) comes from the staff-chat server function after sign-in.
 * This page holds no staff details, card text or answers. Messages are shown as plain text, never as HTML.
 */
(function () {
  "use strict";
  var SB_URL = "https://yoijetxcolixkjqsxkpo.supabase.co", SB_KEY = "sb_publishable_R7CQN_jmNSlHZiGvXa9Jqw_bQv3q3fE";
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var q = new URLSearchParams(location.search);
  var COURSE = UUID.test(q.get("course") || "") ? q.get("course") : null;
  var FOR = /^(D1|D2|M1)$/.test(q.get("for") || "") ? q.get("for") : null;
  // The six order-to-cash interview bots. Other personas (such as the HR help desk, ais/hr/) never show here.
  var INTERVIEW = ["jordan-banks", "grace-liu", "ben-castellano", "luis-ortega", "elena-kowalczyk", "priya-raman"];
  var $ = function (id) { return document.getElementById(id); };
  var SB = null, USER = null, DIR = null, CUR = null, BUSY = false, EMAIL = "";

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
    var res;
    try { res = await sb().functions.invoke("staff-chat", { body: body }); }
    catch (e) { if (e && e.code === "sdk") throw e; throw Object.assign(new Error("Could not reach the staff directory. Check your connection and try again."), { code: "network" }); }
    if (!res.error) return res.data;
    var msg = "Could not reach the staff directory. Check your connection and try again.", code = "network";
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

  // ---------- sign-in (email code, as the InterACCtive labs) ----------
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
    USER = null; DIR = null; CUR = null; showSignIn(); status("Signed out.");
  });

  // ---------- directory ----------
  async function loadDirectory(focusFirst) {
    status("Loading the staff directory…");
    try { DIR = await api({ action: "directory", course_id: COURSE }); }
    catch (e) { status(""); if (e.code === "unauthorized") return showSignIn(e.message); alertMsg(e.message); return; }
    DIR.bots = (DIR.bots || []).filter(function (b) { return INTERVIEW.indexOf(b.id) >= 0; });
    DIR.conversations = (DIR.conversations || []).filter(function (c) { return (!c.bot || INTERVIEW.indexOf(c.bot) >= 0) && c.assignment !== "HR"; });
    $("signin").hidden = true; $("app").hidden = false; alertMsg("");
    $("who").textContent = USER && USER.email ? USER.email : "";
    renderPeople(); renderPast(); renderUsage();
    status(DIR.ready ? "Staff directory loaded." : "");
    if (!DIR.ready) alertMsg("The staff chat isn't switched on yet. Check back later or ask your instructor.");
    if (focusFirst) { var b = document.querySelector("#people button:not([disabled])"); if (b) b.focus(); }
  }
  function renderPeople() {
    var ul = $("people"); ul.textContent = "";
    DIR.bots.forEach(function (b) {
      var li = el("li"), btn = el("button", "sc-person");
      btn.type = "button"; btn.dataset.bot = b.id;
      btn.appendChild(el("b", "", b.name)); btn.appendChild(el("span", "", b.title + (b.available ? "" : " · not available")));
      btn.setAttribute("aria-label", "Interview " + b.name + ", " + b.title + (b.available ? "" : ", not available"));
      if (!b.available || !DIR.ready) btn.disabled = true;
      if (CUR && CUR.bot === b.id) btn.setAttribute("aria-current", "true");
      li.appendChild(btn); ul.appendChild(li);
    });
  }
  function renderPast() {
    var ul = $("past"); ul.textContent = "";
    $("pastNone").hidden = DIR.conversations.length > 0;
    DIR.conversations.forEach(function (c) {
      var li = el("li"), btn = el("button", "sc-conv");
      btn.type = "button"; btn.dataset.conv = c.id;
      btn.appendChild(el("b", "", c.name));
      var meta = fmtDate(c.started_at) + ", " + fmtTime(c.started_at) + " · " + c.student_messages + (c.student_messages === 1 ? " question" : " questions") + (c.assignment ? " · " + c.assignment : "");
      btn.appendChild(el("span", "", meta));
      btn.setAttribute("aria-label", "Open conversation with " + c.name + ", " + meta);
      if (CUR && CUR.id === c.id) btn.setAttribute("aria-current", "true");
      li.appendChild(btn); ul.appendChild(li);
    });
  }
  function renderUsage() {
    var t = "Messages today: " + DIR.today + " of " + DIR.limits.per_day + ".";
    if (CUR) t += " This conversation: " + CUR.student_messages + " of " + DIR.limits.per_conversation + ".";
    $("usage").textContent = t;
  }
  $("people").addEventListener("click", function (e) { var b = e.target.closest("button[data-bot]"); if (b && !b.disabled) startConversation(b.dataset.bot); });
  $("past").addEventListener("click", function (e) { var b = e.target.closest("button[data-conv]"); if (b) openConversation(b.dataset.conv); });

  // ---------- chat ----------
  function showChat(conv, messages) {
    CUR = conv;
    $("chatH").textContent = "Interview with " + conv.name + ", " + conv.title;
    $("chatSub").textContent = (conv.assignment ? conv.assignment + " · " : "") + "Started " + fmtDate(conv.started_at) + ", " + fmtTime(conv.started_at);
    $("chatEmpty").hidden = true; $("log").hidden = false; $("ask").hidden = false;
    var log = $("log"); log.textContent = "";
    // The log itself is silent; each new reply is read out once through the #announce live region.
    messages.forEach(function (m) { log.appendChild(bubble(m.role, m.content, m.at)); });
    log.scrollTop = log.scrollHeight;
    $("announce").textContent = "";
    renderPeople(); renderPast(); renderUsage(); count();
    $("chatH").focus();
  }
  function bubble(role, text, at) {
    var d = el("div", "sc-msg " + (role === "student" ? "me" : role === "staff" ? "staff" : "wait"));
    if (role !== "wait") d.appendChild(el("h3", "", (role === "student" ? "You" : CUR.name) + (at ? ", " + fmtTime(at) : "")));
    d.appendChild(el("p", "", text));
    return d;
  }
  async function startConversation(bot) {
    if (BUSY) return;
    BUSY = true; alertMsg(""); status("Starting the interview…");
    try {
      var r = await api({ action: "start", course_id: COURSE, bot: bot, assignment: FOR });
      DIR.today = r.today; DIR.conversations.unshift(r.conversation);
      showChat(r.conversation, []); status("Interview started. Type your first question.");
      $("msg").focus();
    } catch (e) { status(""); if (e.code === "unauthorized") showSignIn(e.message); else alertMsg(e.message); }
    finally { BUSY = false; }
  }
  async function openConversation(id) {
    if (BUSY) return;
    BUSY = true; alertMsg(""); status("Opening the conversation…");
    try { var t = await api({ action: "transcript", conversation_id: id }); showChat(t.conversation, t.messages); status("Conversation opened."); }
    catch (e) { status(""); if (e.code === "unauthorized") showSignIn(e.message); else alertMsg(e.message); }
    finally { BUSY = false; }
  }
  function count() {
    var n = Array.from($("msg").value).length, max = DIR ? DIR.limits.max_chars : 600;
    $("msgCount").textContent = n + " of " + max + " characters";
    $("msgCount").classList.toggle("over", n > max);
  }
  $("msg").addEventListener("input", count);
  $("msg").addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); $("ask").requestSubmit ? $("ask").requestSubmit() : send(); }
  });
  $("ask").addEventListener("submit", function (e) { e.preventDefault(); send(); });
  async function send() {
    if (BUSY || !CUR) return;
    var text = $("msg").value.trim();
    if (!text) { alertMsg("Type a question first."); $("msg").focus(); return; }
    if (Array.from(text).length > DIR.limits.max_chars) { alertMsg("Keep each message to " + DIR.limits.max_chars + " characters or fewer."); $("msg").focus(); return; }
    BUSY = true; alertMsg("");
    var log = $("log"), mine = bubble("student", text, new Date().toISOString()), wait = bubble("wait", CUR.name.split(" ")[0] + " is replying…");
    log.appendChild(mine); log.appendChild(wait); log.scrollTop = log.scrollHeight;
    $("send").disabled = true; $("send").setAttribute("aria-busy", "true"); status(CUR.name + " is replying…");
    try {
      var r = await api({ action: "send", conversation_id: CUR.id, message: text });
      log.removeChild(wait);
      log.appendChild(bubble("staff", r.reply, new Date().toISOString()));
      $("announce").textContent = CUR.name + " says: " + r.reply;
      log.scrollTop = log.scrollHeight;
      $("msg").value = ""; count();
      CUR.student_messages = r.student_messages; DIR.today = r.today;
      DIR.conversations.forEach(function (c) { if (c.id === CUR.id) c.student_messages = r.student_messages; });
      renderPast(); renderUsage(); status("");
    } catch (e) {
      if (wait.parentNode) log.removeChild(wait);
      if (mine.parentNode) log.removeChild(mine);   // not saved; the text stays in the box to try again
      status("");
      if (e.code === "unauthorized") showSignIn(e.message); else alertMsg(e.message);
    } finally {
      BUSY = false; $("send").disabled = false; $("send").removeAttribute("aria-busy");
      if (!$("app").hidden) $("msg").focus();
    }
  }
  $("restart").addEventListener("click", function () { if (CUR) startConversation(CUR.bot); });

  // ---------- transcript download (plain text, built from the server's saved copy) ----------
  $("download").addEventListener("click", async function () {
    if (!CUR || BUSY) return;
    status("Preparing the transcript…");
    try {
      var t = await api({ action: "transcript", conversation_id: CUR.id });
      var c = t.conversation, lines = [
        "Trailhead staff interview (simulation)",
        "ACCT 2250 / ACCT 6641 · Accounting Information Systems",
        "Staff member: " + c.name + ", " + c.title,
        "Interviewer: " + (USER && USER.email ? USER.email : ""),
        "Assignment: " + (c.assignment || "not set"),
        "Started: " + new Date(c.started_at).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" }),
        "Conversation ID: " + c.id + " (card " + c.card_version + ")",
        "The staff are AI chatbots playing fictional employees. They can be wrong or disagree with each other.",
        ""];
      t.messages.forEach(function (m) { lines.push("[" + fmtTime(m.at) + "] " + (m.role === "student" ? "You" : c.name) + ": " + m.content, ""); });
      var blob = new Blob([lines.join("\r\n")], { type: "text/plain;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "trailhead-interview-" + c.bot + "-" + c.started_at.slice(0, 10) + "-" + c.id.slice(0, 8) + ".txt";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      status("Transcript downloaded: " + a.download);
    } catch (e) { status(""); if (e.code === "unauthorized") showSignIn(e.message); else alertMsg(e.message); }
  });

  // ---------- start ----------
  async function init() {
    if (!COURSE) { alertMsg("Open the staff directory from the link in Canvas. This link doesn't say which class you're in."); return; }
    try {
      var r = await sb().auth.getSession();
      USER = r.data && r.data.session ? r.data.session.user : null;
    } catch (e) { alertMsg(e.message); return; }
    if (USER) loadDirectory(false); else showSignIn();
  }
  if (document.readyState === "complete") init(); else window.addEventListener("load", init, { once: true });
})();
