/* ACCT 1102 Managerial Accounting labs: shared page frame.
 *
 * Built from the Financial Accounting labs' Inventory Costing Lab page (rgoodwi3/Inventory-Cost-Flows):
 * the same header, timeline of numbered parts, practice engine and graded-mode client. A lab page loads
 * ma/frame.css and this file, then calls MAFrame.start() with its own block:
 *
 *   MAFrame.start({
 *     slug, key, title, module ("M1"), dataTitle, footer, seedMin, seedMax,
 *     phases: [["id","Label"], ...],          // timeline groups, in order
 *     setYear(y),                             // sets the page's YEAR (graded mode uses the attempt's lab_year)
 *     gen(seed) -> P, parts(P) -> PARTS,      // the problem and its parts (fields with ans, work, wrong)
 *     grade(part, vals) -> {res, all},        // the part's grading; the server runs the same code
 *     fromInfo(info) -> P,                    // graded mode: the problem as far as the server's public info shows it
 *     biz() -> html, data(ctx) -> {title?, sub?, html}
 *   })
 *
 * A part: {id, phase, tick, title, desc, layout: "list" | "table" | "sched" | "je", fields: [...], why?, hint?, walk?}
 *   table: cols [{key,label}], items [{text, amount?}]; each field has row (item index) and col (column key);
 *          fields without a row are listed below the table.
 *   je: lines [{side: "Dr"|"Cr", a: account field id, v: amount field id}] (a journal entry).
 *   sched: sched {title: [lines], lines: [{t: "head"|"line"|"sub"|"total"|"given", label, ind, f (field id), col: 1|2, v}]}
 * A field: {id, label, kind ("sel", "$", "n", "pct"), opts [[value,text]], ans, work, wrong(v, nums)}.
 * Every field is worth 1 point in graded mode. Nothing here grades: practice mode calls L.grade, graded mode
 * shows what the lab-attempt edge function returns.
 */
(function () {
"use strict";
window.MAFrame = { start: start };

function start(L) {
const $ = id => document.getElementById(id);
const PYEAR = new Date().getFullYear();
let YEAR = PYEAR;
const KEY = L.key, LAB_SLUG = L.slug;
const SB_URL = "https://yoijetxcolixkjqsxkpo.supabase.co", SB_KEY = "sb_publishable_R7CQN_jmNSlHZiGvXa9Jqw_bQv3q3fE";
const GKEY = KEY + ".graded", MKEY = KEY + ".mode"; // GKEY holds only a pointer to the server attempt
const PHASES = L.phases, PH = {}; PHASES.forEach((p, i) => { PH[p[0]] = { i: i, label: p[1] }; });
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = n => Math.abs(n).toLocaleString("en-US");
const randomSeed = () => { const a = L.seedMin || 10000, b = L.seedMax || 99999; return a + Math.floor(Math.random() * (b - a + 1)); };
const parseNum = s => { s = String(s == null ? "" : s).replace(/[$,%\s]/g, ""); if (s === "") return null; const neg = /^\(.*\)$/.test(s); s = s.replace(/[()]/g, "").replace(/^−/, "-"); const n = Number(s); return isFinite(n) ? (neg ? -n : n) : NaN; };
const isSel = f => f.kind === "sel";

// ---------- page shell ----------
document.body.insertAdjacentHTML("afterbegin",
  '<a class="skip" href="#pPart">Skip to the current part</a>' +
  '<header class="band1" id="band1"><div class="wrap"><div class="b1-row"><div>' +
  '<div class="eyebrow">University of New Haven · ACCT 1102 · Introduction to Managerial Accounting · ' + esc(L.module) + ' Lab</div>' +
  '<h1>' + esc(L.title) + '</h1></div><p class="biz" id="biz"></p>' +
  '<div class="b1-right"><div class="setchip" id="setChip">Problem set <b>—</b></div><button type="button" class="newset" id="newSet">New numbers</button></div></div>' +
  '<div class="gk-row"><span class="gk-label">Mode</span><div class="modesw" id="modeSw" role="group" aria-label="Mode"><button type="button" data-mode="practice" aria-pressed="true">Practice</button><button type="button" data-mode="graded" aria-pressed="false">Graded</button></div></div>' +
  '</div></header>' +
  '<div class="band2" id="band2"><div class="wrap"><nav class="timeline" id="timeline" aria-label="Parts of the lab"></nav>' +
  '<div class="status"><div id="where" aria-live="polite"></div><span class="score" id="score" hidden></span>' +
  '<div class="legend-dots" id="legendDots"><span><i style="background:var(--good)"></i>First try</span><span><i style="background:var(--gold)"></i>Retried</span><span><i style="background:var(--muted)"></i>Answer shown</span></div></div></div></div>' +
  '<main class="wrap" id="main"><div class="grid-top" id="gridTop">' +
  '<section class="panel" id="pData" aria-labelledby="dataH"><div class="panel-h"><h2 id="dataH">' + esc(L.dataTitle || "Data") + '</h2><span class="sub" id="dataSub"></span></div><div class="panel-b" id="data"></div></section>' +
  '<section class="panel" id="pPart" aria-labelledby="partH" tabindex="-1"><div class="panel-h"><h2 id="partH">Your work</h2><span class="sub" id="partSub"></span></div><div class="panel-b" id="part" aria-live="polite"></div></section>' +
  '</div></main>' +
  '<footer class="wrap">' + esc(L.footer || "Problem Solvers, Inc. and all figures are illustrative. The same problem set number always gives the same numbers.") + '</footer>' +
  '<dialog class="gdlg" id="gDlg" aria-labelledby="gDlgH"><div class="gdlg-h"><div class="eyebrow">' + esc(L.title) + '</div><h2 id="gDlgH">Graded mode</h2></div><div class="gdlg-b" id="gDlgB"></div></dialog>');
document.title = L.title + " · ACCT 1102";

function setYear(y) { YEAR = y; L.setYear(y); $("biz").innerHTML = L.biz(); }
setYear(PYEAR);

// ---------- state ----------
let P = null, seed = 0, PARTS = [], cur = 0, st = [];
let MODE = "practice", GS = null, PENDING = null, BUSY = false, STEPS = [];
function blank() { return { vals: {}, fb: null, tries: 0, revealed: false, shown: {}, walk: -1, status: null, warn: null }; }
const graded = () => MODE === "graded";
function save() {
  try {
    if (!PENDING) localStorage.setItem(MKEY, MODE);
    if (graded() && GS) { localStorage.setItem(GKEY, JSON.stringify({ attempt: GS.id, course: GS.course })); return; }
    if (P) localStorage.setItem(KEY, JSON.stringify({ seed: seed, cur: cur, year: YEAR, st: st.map(s => ({ vals: s.vals, tries: s.tries, revealed: s.revealed, shown: s.shown, status: s.status })) }));
  } catch (e) { /* storage unavailable */ }
}
function buildSet(sd) { seed = sd; P = L.gen(sd); PARTS = L.parts(P); st = PARTS.map(blank); cur = 0; setChip(); buildTimeline(); }
function urlSet() {
  try {
    const m = /^#set(\d{1,10})$/.exec(location.hash || ""); if (m) return +m[1];
    const q = new URLSearchParams(location.search).get("set"); if (q && /^\d{1,10}$/.test(q)) return +q;
  } catch (e) { /* ignore */ }
  return null;
}
function load() {
  let m = null, ptr = null;
  try { ptr = JSON.parse(localStorage.getItem(GKEY) || "null"); m = localStorage.getItem(MKEY); } catch (e) { ptr = null; }
  // A graded attempt is resumed from the server once the Supabase library has loaded (see the end).
  if (m === "graded" && !urlSet() && ptr && typeof ptr.attempt === "string" && COURSE && ptr.course === COURSE) PENDING = ptr.attempt;
  loadPractice();
}
function loadPractice() {
  let o = null; try { o = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { o = null; }
  if (o && o.year !== YEAR) o = null;
  const hs = urlSet();
  if (hs && (!o || o.seed !== hs)) { buildSet(hs); return; }
  if (o && o.seed) {
    try {
      buildSet(o.seed);
      if (Array.isArray(o.st) && o.st.length === PARTS.length) o.st.forEach((x, i) => { Object.assign(st[i], x); st[i].shown = x.shown || {}; if (x.status && !x.revealed) st[i].fb = L.grade(PARTS[i], st[i].vals); });
      cur = Math.max(0, Math.min(PARTS.length - 1, o.cur | 0)); return;
    } catch (e) { /* fall through to a new set */ }
  }
  buildSet(randomSeed());
}
function setChip() {
  const c = $("setChip"), g = graded();
  c.classList.toggle("graded", g);
  c.innerHTML = g ? "Graded attempt" : 'Problem set <b>#' + seed + '</b>';
  c.title = g ? "Walk me through it and Show answers are off. Only your first submission on each part counts." : "The same problem set number always gives the same numbers";
  $("newSet").hidden = g;
}
$("newSet").addEventListener("click", () => { if (graded()) return; let sd = randomSeed(); if (sd === seed) sd++; buildSet(sd); render(); scrollPart(); });

// What the data panel and parts may use: known answers only (a finished part's, or a graded part the server has answered).
function known(pid, fid) {
  const i = PARTS.findIndex(p => p.id === pid); if (i < 0) return null;
  const f = (PARTS[i].fields || []).find(x => x.id === fid);
  if (!f || f.ans == null) return null;
  if (graded()) return f.ans;
  return st[i].status || st[i].revealed && st[i].shown[fid] ? f.ans : null;
}
function okField(pid, fid) {
  const i = PARTS.findIndex(p => p.id === pid); if (i < 0) return false;
  const s = st[i]; if (s.revealed && s.shown[fid]) return true;
  return !!(s.fb && s.fb.res && s.fb.res[fid] && s.fb.res[fid].ok) || (!!s.status && !s.revealed);
}
function ctx() {
  return { P: P, parts: PARTS, cur: cur, part: PARTS[cur], graded: graded(), YEAR: YEAR, esc: esc, fmt: fmt,
    ans: known, ok: okField, walk: !graded() && st[cur] ? st[cur].walk : -1, done: pid => { const i = PARTS.findIndex(p => p.id === pid); return i >= 0 && !!st[i].status && (!graded() || gKnown(i)); } };
}

// ---------- graded mode (server) ----------
// The class and lab come from the course page link: ?course=<id>&lab=<slug>
const COURSE = (() => {
  try { const q = new URLSearchParams(location.search); const c = q.get("course") || "";
    return q.get("lab") === LAB_SLUG && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c) ? c : null; } catch (e) { return null; }
})();
let SB = null;
function sb() {
  if (!SB) {
    if (!window.supabase || !window.supabase.createClient) { const e = new Error("The sign-in service didn't load. Check your connection and reload the page."); e.code = "sdk"; throw e; }
    SB = window.supabase.createClient(SB_URL, SB_KEY);
  }
  return SB;
}
async function currentUser() { const r = await sb().auth.getSession(); return r.data && r.data.session ? r.data.session.user : null; }
// Calls the lab-attempt edge function as the signed-in student. Throws an Error with .code and a message to show.
async function api(body) {
  let res;
  try { res = await sb().functions.invoke("lab-attempt", { body: body }); }
  catch (e) { if (e && e.code === "sdk") throw e; const x = new Error("Could not reach the grading server. Check your connection and try again."); x.code = "network"; throw x; }
  if (!res.error) return res.data;
  let msg = "Could not reach the grading server. Check your connection and try again.", code = "network";
  try {
    const c = res.error.context;
    if (c && typeof c.json === "function") {
      const j = await c.json(); if (j && j.message) msg = j.message; if (j && (j.error || j.code)) code = String(j.error || j.code);
      if (c.status === 401) { code = "unauthorized"; msg = "Your sign-in has expired. Sign in again to keep going."; }
    }
  } catch (e) { /* keep the generic message */ }
  const x = new Error(msg); x.code = code; throw x;
}
function gTotal() { return GS.max.reduce((t, x) => t + x, 0); }
function gEarned() { return GS ? GS.pts.reduce((t, x) => t + (x || 0), 0) : 0; }
function gScoredMax() { let t = 0; for (let i = 0; i < GS.max.length; i++) if (GS.done[i]) t += GS.max[i]; return t; }
function gScoreText() { return GS.finishedAt ? "Graded · final score " + GS.score + " of " + GS.total + " points" : gScoredMax() ? "Graded · " + gEarned() + " of " + gScoredMax() + " points so far (" + gTotal() + " possible)" : "Graded · " + gTotal() + " points possible"; }
// Classes that hide answers send no solution. A part can only be left once every answer is right, so the
// student's own corrected answers stand for the answers. They are kept in this browser so a reload keeps them.
function ownKey() { return KEY + ".own." + (GS && GS.id); }
function ownLoad() { try { return JSON.parse(localStorage.getItem(ownKey()) || "{}") || {}; } catch (e) { return {}; } }
function ownSave(i, a) { try { const o = ownLoad(); o[i] = a; localStorage.setItem(ownKey(), JSON.stringify(o)); } catch (e) { /* ignore */ } }
async function enterAttempt(id) { const p = await api({ action: "problem", attempt_id: id }); applyProblem(p); render(); scrollPart(); gFocus(); }
function exitGraded() { save(); MODE = "practice"; setYear(PYEAR); loadPractice(); }
function when(ms) { return new Date(ms).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).replace(/ /g, " "); }
function markBusy(act, label) { document.querySelectorAll('#part [data-act="' + act + '"]').forEach(b => { b.disabled = true; b.setAttribute("aria-busy", "true"); if (label) b.textContent = label; }); }
function onApiError(e) { if (e && e.code === "unauthorized") { USER = null; openGDlg(e.message); } }
async function finishGraded() {
  if (BUSY) return;
  BUSY = true; GS.err = null; markBusy("finishG", "Finishing…");
  try { const r = await api({ action: "finish", attempt_id: GS.id }); GS.finishedAt = r.finished_at; GS.score = r.score; GS.total = r.total; BUSY = false; GS.atEnd = true; render(); scrollPart(); }
  catch (e) { BUSY = false; GS.err = e.message; GS.atEnd = true; render(); onApiError(e); }
  finally { BUSY = false; }
}
function renderGradedDone() {
  const fin = !!GS.finishedAt;
  $("partH").textContent = fin ? "Graded attempt complete" : "Finish your graded attempt";
  $("partSub").textContent = fin ? "Your score is saved" : "";
  let rows = "";
  STEPS.forEach((s, i) => { const mx = GS.max[i]; if (!mx) return; const p = GS.pts[i] || 0;
    rows += '<tr class="' + (p < mx ? "miss" : "") + '"><td>Part ' + (i + 1) + '</td><td>' + esc(s.title || "") + '</td><td class="r">' + (GS.done[i] ? p : "—") + ' / ' + mx + '</td></tr>'; });
  const table = '<details class="pts"><summary>Your points by part</summary><table class="ptab"><tbody>' + rows + '</tbody></table></details>';
  if (!fin) {
    $("part").innerHTML = '<h3 class="part-title" style="margin-top:0">You have submitted every part</h3><p class="part-desc">Finish the attempt to record your score. After you finish, your score can\'t change.</p>' +
      (GS.err ? '<div class="overall no"><b>Not finished yet.</b> ' + esc(GS.err) + '</div>' : '') + table + controls('<button class="btn primary" data-act="finishG">Finish and see your score →</button>');
    return;
  }
  const pct = GS.total ? Math.round(GS.score / GS.total * 100) : 0;
  $("part").innerHTML = '<h3 class="part-title" style="margin-top:0">You finished the graded lab: ' + GS.score + ' of ' + GS.total + ' points (' + pct + '%)</h3>' +
    '<div class="final"><b>Score: ' + GS.score + ' / ' + GS.total + '</b><br>Finished ' + esc(when(GS.finishedAt)) + '<br>Started ' + esc(when(GS.startedAt)) + '</div>' +
    '<p class="part-desc">Your score is saved to your class, so there is nothing to copy or turn in. Your instructor sees it in the gradebook.</p>' + table + controls('');
}
function gBar() {
  const g = graded(), sc = $("score");
  sc.classList.toggle("graded", g);
  if (g) { sc.hidden = false; sc.textContent = gScoreText(); }
  const lg = $("legendDots");
  if (!lg.dataset.practice) lg.dataset.practice = lg.innerHTML;
  lg.innerHTML = g ? '<span><i style="background:var(--good)"></i>Full credit</span><span><i style="background:var(--gold)"></i>Partial or no credit</span>' : lg.dataset.practice;
  $("timeline").classList.toggle("locked", g);
  document.querySelectorAll("#modeSw [data-mode]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === MODE)));
}

// mode switch, sign-in and rules dialog
let dlgConfirm = false, USER = null;
const DLG = { stage: "email", email: "", err: null, info: null, busy: false };
function rulesHTML() {
  const pts = graded() && GS ? gTotal() : null;
  return '<ul>' +
    '<li><b>No walk-throughs or answers.</b> Walk me through it and Show answers are turned off.</li>' +
    '<li><b>Only your first submission counts.</b> Each answer is worth 1 point' + (pts ? ' (' + pts + ' points in all)' : '') + '. After you submit, you\'ll see what is wrong and why, and you must fix it to move on, but retries don\'t change your score.</li>' +
    '<li><b>No going back.</b> You can\'t return to earlier parts or start over during the attempt.</li>' +
    '<li><b>Saved to your account.</b> You get a new problem set, graded and saved on the server as you go. You can leave and come back, even on another device, but the clock keeps running.</li>' +
    '<li><b>Your score goes to your class.</b> When you finish, your score and finish time are recorded for your instructor. There is nothing to copy or paste.</li>' +
    '<li><b>Work on your own.</b> Getting help from another person or an AI tool, or sharing your answers, is academic dishonesty. Every attempt has its own numbers.</li>' +
    '<li><b>How you answer is recorded.</b> Along with your answers and times, the lab notes how they were entered (typing, pasting, leaving this page, and signs of AI or automation tools) for your instructor to review. It never records what you type anywhere else.</li></ul>';
}
function signInHTML() {
  if (DLG.stage === "code") return '<div class="signin"><p style="margin:0">We sent a sign-in email to <b>' + esc(DLG.email) + '</b>. Enter the code from the email here.</p>' +
    '<label for="gCode">Code from the email</label><input id="gCode" inputmode="numeric" autocomplete="one-time-code" maxlength="10">' +
    '<div class="gdlg-actions" style="justify-content:flex-start;margin-top:4px"><button class="btn primary" data-g="verify">Sign in</button><button class="btn" data-g="restart">Use a different email</button></div></div>';
  return '<div class="signin"><p style="margin:0"><b>Sign in to start a graded attempt.</b> Use the email address you use for your course page.</p>' +
    '<label for="gEmail">Email</label><input id="gEmail" type="email" autocomplete="email" value="' + esc(DLG.email) + '">' +
    '<div class="gdlg-actions" style="justify-content:flex-start;margin-top:4px"><button class="btn primary" data-g="send">Email me a sign-in code</button></div></div>';
}
function paintGDlg() {
  const live = GS && !GS.finishedAt, fin = GS && GS.finishedAt;
  let h = '<p style="margin:0">Graded mode works like a quiz:</p>' + rulesHTML(), btn = '<button class="btn" data-g="cancel">' + (graded() ? "Back to the lab" : "Stay in practice") + '</button>';
  if (DLG.err) h += '<div class="gdlg-note warn" role="alert">' + esc(DLG.err) + '</div>';
  if (DLG.info) h += '<div class="gdlg-note">' + esc(DLG.info) + '</div>';
  if (!COURSE) {
    h += '<div class="gdlg-note warn"><b>Open this lab from your course page to use Graded mode.</b> Graded attempts belong to a class, and this link doesn\'t say which one.</div>';
  } else if (!USER) {
    h += signInHTML();
  } else {
    h += '<div class="signin"><span class="who">Signed in as ' + esc(USER.email || "") + '. <button class="btn small" data-g="signout">Sign out</button></span></div>';
    if (dlgConfirm) {
      h += '<div class="gdlg-note warn"><b>Start another graded attempt?</b> Your finished attempt and its score stay saved. A new attempt gets new numbers, if your class allows more than one attempt.</div>';
      btn += '<button class="btn primary" data-g="start">Yes, start a new attempt</button>';
    } else if (live && graded()) {
      h += '<div class="gdlg-note">You are in a graded attempt that started ' + esc(when(GS.startedAt)) + '.</div>';
      btn = '<button class="btn primary" data-g="cancel">Back to the lab</button>';
    } else if (live) {
      h += '<div class="gdlg-note">You have a graded attempt in progress. It started ' + esc(when(GS.startedAt)) + '.</div>';
      btn += '<button class="btn primary" data-g="resume">Resume my attempt</button>';
    } else if (fin) {
      h += '<div class="gdlg-note">You finished a graded attempt on ' + esc(when(GS.finishedAt)) + ' with ' + GS.score + ' of ' + GS.total + ' points.</div>';
      btn += '<button class="btn" data-g="new">Start a new attempt</button><button class="btn primary" data-g="resume">View my score</button>';
    } else {
      h += '<div class="gdlg-note">If you already started a graded attempt for this class, you\'ll pick up where you left off.</div>';
      btn += '<button class="btn primary" data-g="start">Start graded attempt</button>';
    }
    if (btn.indexOf('data-g="start"') >= 0) {
      h += '<label class="pledge"><input type="checkbox" id="pledge"> <span>I will complete this graded attempt on my own, without help from another person or an AI tool, and I will not share my answers.</span></label>';
      btn = btn.replace('data-g="start"', 'data-g="start" disabled');
    }
  }
  $("gDlgB").innerHTML = h + '<div class="gdlg-actions">' + btn + '</div>';
  if (DLG.busy) $("gDlgB").querySelectorAll(".btn").forEach(b => { b.disabled = true; });
}
async function openGDlg(note) {
  dlgConfirm = false; DLG.err = note || null; DLG.info = null;
  if (COURSE) { try { USER = await currentUser(); } catch (e) { USER = null; DLG.err = e.message; } }
  paintGDlg();
  const d = $("gDlg"); if (!d.open) { if (d.showModal) d.showModal(); else d.setAttribute("open", ""); }
  const p = d.querySelector("#gCode") || d.querySelector("#gEmail") || d.querySelector("#pledge") || d.querySelector(".btn.primary"); if (p) p.focus();
}
function closeGDlg() { const d = $("gDlg"); if (d.close) d.close(); else d.removeAttribute("open"); }
async function dlgRun(fn) {
  if (DLG.busy) return; DLG.busy = true; DLG.err = null; DLG.info = null; paintGDlg();
  try { await fn(); } catch (e) { DLG.err = e && e.message ? e.message : "Something went wrong. Try again."; onApiError(e); }
  finally { DLG.busy = false; if ($("gDlg").open) paintGDlg(); }
}
$("gDlgB").addEventListener("click", e => {
  const b = e.target.closest("[data-g]"); if (!b || b.disabled) return; const g = b.dataset.g;
  if (g === "cancel") { closeGDlg(); return; }
  if (g === "new") { dlgConfirm = true; paintGDlg(); const p = $("pledge"); if (p) p.focus(); return; }
  if (g === "restart") { DLG.stage = "email"; DLG.err = null; paintGDlg(); return; }
  if (g === "send") {
    const email = ($("gEmail").value || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { DLG.err = "Enter your email address."; paintGDlg(); return; }
    DLG.email = email;
    dlgRun(async () => {
      const r = await sb().auth.signInWithOtp({ email: email, options: { shouldCreateUser: false, emailRedirectTo: location.href.split("#")[0] } });
      if (r.error) throw new Error(/signups? not allowed|not found/i.test(r.error.message) ? "There is no account for that email. Join your class on the course page first." : r.error.message);
      DLG.stage = "code";
    });
    return;
  }
  if (g === "verify") {
    const token = ($("gCode").value || "").replace(/\s/g, "");
    if (!token) { DLG.err = "Enter the code from the email."; paintGDlg(); return; }
    dlgRun(async () => {
      const r = await sb().auth.verifyOtp({ email: DLG.email, token: token, type: "email" });
      if (r.error) throw new Error("That code didn't work. Check it, or send a new one.");
      USER = r.data.user; DLG.stage = "email";
    });
    return;
  }
  if (g === "signout") { dlgRun(async () => { await sb().auth.signOut(); USER = null; if (graded()) { exitGraded(); render(); } GS = null; try { localStorage.removeItem(GKEY); } catch (x) { /* ignore */ } }); return; }
  if (g === "start" && !($("pledge") && $("pledge").checked)) return;
  if (g === "start" || g === "resume") {
    dlgRun(async () => {
      const id = g === "resume" ? GS.id : (await api({ action: "start", course_id: COURSE, lab: LAB_SLUG })).attempt_id;
      if (window.IACSignals) window.IACSignals.reset();
      await enterAttempt(id); closeGDlg();
    });
  }
});
$("gDlgB").addEventListener("change", e => { if (e.target.id === "pledge") { const b = $("gDlgB").querySelector('[data-g="start"]'); if (b) b.disabled = !e.target.checked; } });
$("gDlgB").addEventListener("keydown", e => {
  if (e.key !== "Enter") return;
  if (e.target.id === "gEmail") { e.preventDefault(); const b = $("gDlgB").querySelector('[data-g="send"]'); if (b) b.click(); }
  else if (e.target.id === "gCode") { e.preventDefault(); const b = $("gDlgB").querySelector('[data-g="verify"]'); if (b) b.click(); }
});
$("modeSw").addEventListener("click", e => {
  const b = e.target.closest("[data-mode]"); if (!b) return;
  if (b.dataset.mode === "graded") openGDlg();
  else if (graded()) { exitGraded(); render(); scrollPart(); }
});

function gFocus() { const f = $("part").querySelector("input:not([disabled]),select:not([disabled])"); if (f) f.focus({ preventScroll: true }); }
function gKnown(i) { const pt = PARTS[i]; return !!pt && !!pt.fields && pt.fields.every(f => f.ans != null); }
function applySol(i, sol) {
  const pt = PARTS[i]; if (!pt || !sol) return;
  if (sol.why) pt.why = sol.why;
  (sol.fields || []).forEach(x => { const f = pt.fields.find(y => y.id === x.id); if (f) { f.ans = x.ans; f.work = x.work; } });
}
function ownCalc(pt, vals) {
  if (!pt || !pt.fields || !vals) return;
  pt.fields.forEach(f => { const raw = vals[f.id]; if (raw == null || raw === "") return;
    if (isSel(f)) { f.ans = raw; return; }
    const v = parseNum(raw); if (v !== null && !isNaN(v)) f.ans = v; });
}
function applyProblem(pr) {
  if (MODE === "practice" && P) save();
  MODE = "graded"; seed = 0;
  setYear(pr.lab_year); // every date and label follows the attempt, even if it is finished after New Year
  PARTS = JSON.parse(JSON.stringify(pr.steps)); STEPS = PARTS;
  GS = { id: pr.attempt_id, course: COURSE, info: pr.info, startedAt: pr.started_at, finishedAt: pr.finished_at || null, atEnd: false,
    score: pr.score == null ? null : pr.score, total: pr.total == null ? null : pr.total, max: pr.max_points.slice(), pts: [], done: [], err: null };
  st = PARTS.map(blank);
  const ownSaved = ownLoad();
  Object.keys(pr.progress || {}).forEach(key => {
    const i = +key, r = pr.progress[key], pt = PARTS[i]; if (!pt) return;
    GS.done[i] = true; GS.pts[i] = r.points; st[i].status = r.points === r.maxPoints ? "first" : "retry";
    const a = r.points === r.maxPoints ? r.answer : ownSaved[i];
    if (a && a.vals) st[i].vals = a.vals;
    if (r.solution) applySol(i, r.solution); else if (a) ownCalc(pt, a.vals);
  });
  const nx = pr.next_step | 0;
  GS.atEnd = !!GS.finishedAt || nx >= PARTS.length; cur = Math.max(0, Math.min(PARTS.length - 1, nx));
  P = L.fromInfo ? L.fromInfo(pr.info || {}) : (pr.info || {});
  setChip(); buildTimeline();
}
function incompletePart(pt, s) {
  for (const f of pt.fields) {
    const raw = s.vals[f.id];
    if (isSel(f)) { if (!raw) return "Answer every question."; continue; }
    const v = parseNum(raw);
    if (v === null) return "Fill in every answer box.";
    if (Number.isNaN(v)) return "Enter numbers only, like 2400 or 2,400.";
  }
  return null;
}
async function submitPart() {
  if (BUSY) return;
  const i = cur, pt = PARTS[i], s = st[i];
  if (!GS.done[i]) { const w = incompletePart(pt, s); if (w) { s.warn = w; renderPart(); return; } }
  s.warn = null; BUSY = true; markBusy("check", "Submitting…");
  const answer = { vals: Object.assign({}, s.vals) };
  try {
    const r = await api({ action: "submit-step", attempt_id: GS.id, step: i, answer: answer, signals: window.IACSignals ? window.IACSignals.take() : null });
    if (!graded() || cur !== i) return;
    s.tries++; s.fb = r.feedback; GS.done[i] = true; GS.pts[i] = r.points;
    if (r.next && PARTS[i + 1] && PARTS[i + 1].locked) PARTS[i + 1] = r.next; // the server sends each part's text when it is reached
    if (r.solution) applySol(i, r.solution);
    if (r.correct || (r.feedback && r.feedback.all)) {
      if (!r.solution) { ownCalc(pt, answer.vals); ownSave(i, answer); }
      s.status = GS.pts[i] === GS.max[i] ? "first" : "retry";
    }
    BUSY = false; render();
    const bad = $("part").querySelector(".no input,.no select,select.no"); if (bad) bad.focus(); else { const n = $("part").querySelector('[data-act="next"],[data-act="finishG"]'); if (n) n.focus({ preventScroll: true }); }
  } catch (e) { BUSY = false; s.warn = e.message; renderPart(); onApiError(e); }
  finally { BUSY = false; }
}
function gPartCard(h, s, lock) {
  if (!GS.done[cur]) h = h.replace('<!--fields-->', '<div class="gnote">Graded: only your first submission on this part counts. Each answer is worth 1 point (' + GS.max[cur] + ' points). Fill in every answer before you submit.</div>');
  if (s.warn) h += '<div class="overall no" role="alert"><b>Not submitted yet.</b> ' + esc(s.warn) + ' Only your first complete submission is scored.</div>';
  if (s.fb && GS.done[cur]) {
    const p = GS.pts[cur] || 0, mx = GS.max[cur];
    if (s.fb.all) h += '<div class="overall ok"><b>✓ All correct.</b> Your first submission earned ' + p + ' of ' + mx + ' points.' + (p < mx ? " Retries don't change your score." : "") + '</div>';
    else { const n = Object.values(s.fb.res).filter(x => x && !x.ok).length; h += '<div class="overall no"><b>Not quite.</b> Your first submission earned ' + p + ' of ' + mx + ' points. Fix the ' + (n === 1 ? "answer" : n + " answers") + ' marked ✗ to move on; retries don\'t change your score.</div>'; }
  } else if (GS.done[cur] && lock) h += '<div class="overall ok"><b>Submitted.</b> Your first submission earned ' + (GS.pts[cur] || 0) + ' of ' + GS.max[cur] + ' points.</div>';
  const prim = lock ? (cur < PARTS.length - 1 ? '<button class="btn primary" data-act="next">Next part →</button>' : '<button class="btn primary" data-act="finishG">Finish and see your score →</button>') :
    '<button class="btn primary" data-act="check">' + (GS.done[cur] ? "Check my answers" : "Submit answers") + '</button>';
  return h + controls(prim);
}

// ---------- timeline ----------
function buildTimeline() {
  let h = "";
  PHASES.forEach((ph, k) => {
    const idx = PARTS.map((p, i) => p.phase === ph[0] ? i : -1).filter(i => i >= 0);
    if (!idx.length) return;
    h += '<div class="phase ph-' + (k % 3) + '"><div class="phase-label">' + esc(ph[1]) + '</div><div class="ticks">';
    idx.forEach(i => { h += '<button type="button" class="tick" data-i="' + i + '">' + esc(PARTS[i].tick || String(i + 1)) + '</button>'; });
    h += '</div></div>';
  });
  $("timeline").innerHTML = h;
}
$("timeline").addEventListener("click", e => { if (graded()) return; const t = e.target.closest(".tick"); if (t) { cur = +t.dataset.i; render(); scrollPart(); } });
const SLAB = { first: "correct on first try", retry: "correct after retrying", shown: "answer shown" };
function renderBar() {
  const n = st.filter(s => s.status).length, first = st.filter(s => s.status === "first").length;
  $("where").innerHTML = '<b>' + n + ' of ' + PARTS.length + '</b> parts finished · now on ' + esc(PARTS[cur].title || "");
  const sc = $("score"); sc.hidden = n === 0; sc.textContent = "First-try correct: " + first + " of " + n; gBar();
  document.querySelectorAll(".tick").forEach(t => {
    const i = +t.dataset.i;
    t.className = "tick" + (st[i].status ? " done" : "") + (i === cur ? " cur" : "") + (st[i].status ? " s-" + st[i].status : "");
    t.title = (PARTS[i].title || "") + (st[i].status ? " (" + SLAB[st[i].status] + ")" : "");
    t.setAttribute("aria-label", "Part " + (i + 1) + ": " + (PARTS[i].title || "") + (st[i].status ? ", " + SLAB[st[i].status] : ""));
    if (i === cur) t.setAttribute("aria-current", "step"); else t.removeAttribute("aria-current");
  });
}

// ---------- data panel ----------
function renderData() {
  const d = L.data(ctx()) || {};
  const o = typeof d === "string" ? { html: d } : d;
  $("dataH").textContent = o.title || L.dataTitle || "Data";
  $("dataSub").textContent = o.sub || "";
  $("data").innerHTML = o.html || "";
  $("pData").hidden = !o.html;
  $("gridTop").classList.toggle("wide", !o.html);
}

// ---------- part card ----------
function cls(s, f) {
  if (s.revealed && s.shown[f.id]) return " shown";
  const r = s.fb && s.fb.res[f.id]; return r ? (r.ok ? " ok" : " no") : "";
}
function control(p, f, s, lock, label) {
  const val = s.vals[f.id] == null ? "" : s.vals[f.id];
  if (isSel(f)) {
    return '<select data-f="' + esc(f.id) + '" aria-label="' + esc(label) + '"' + (lock ? " disabled" : "") + ' class="' + cls(s, f).trim() + '"><option value="">Choose…</option>' +
      f.opts.map(o => '<option value="' + esc(o[0]) + '"' + (val === o[0] ? " selected" : "") + '>' + esc(o[1]) + '</option>').join("") + '</select>';
  }
  const pre = f.pre != null ? f.pre : f.kind === "$" ? "$" : "", post = f.post != null ? f.post : f.kind === "pct" ? "%" : "";
  return '<div class="inbox' + cls(s, f) + '">' + (pre ? '<span class="pre" aria-hidden="true">' + esc(pre) + '</span>' : '') + '<input data-f="' + esc(f.id) + '" inputmode="decimal" autocomplete="off" aria-label="' + esc(label) + '" value="' + esc(val) + '"' + (lock ? " disabled" : "") + '>' + (post ? '<span class="post" aria-hidden="true">' + esc(post) + '</span>' : '') + '</div>';
}
function msgHTML(r) { return '<div class="fmsg ' + (r.ok ? "ok" : "no") + '"><span aria-hidden="true">' + (r.ok ? "✓" : "✗") + '</span><span>' + esc(r.msg) + '</span></div>'; }
function showWork(s, f) { return f.work != null && (s.revealed && s.shown[f.id] || !!(s.fb && s.fb.all && s.fb.res[f.id] && s.fb.res[f.id].ok)); }
function listHTML(p, s, lock, fields) {
  let h = '<div class="fields">';
  (fields || p.fields).forEach(f => {
    const r = s.fb && s.fb.res[f.id];
    h += '<div class="field' + cls(s, f) + '" data-wrap="' + esc(f.id) + '"><div class="frow' + (isSel(f) ? " sel" : "") + '"><label class="flabel">' + esc(f.label) + (f.sub ? '<small>' + esc(f.sub) + '</small>' : '') + '</label>' + control(p, f, s, lock, f.label) + '</div>';
    if (r && !(s.revealed && s.shown[f.id])) h += msgHTML(r);
    if (showWork(s, f)) h += '<div class="work">' + esc(f.work) + '</div>';
    h += '</div>';
  });
  return h + '</div>';
}
function tableHTML(p, s, lock) {
  const hasAmt = p.items.some(it => it.amount != null), span = 1 + (hasAmt ? 1 : 0) + p.cols.length;
  let h = '<div class="scroll"><table class="ctab"><thead><tr><th scope="col">' + esc(p.itemLabel || "Item") + '</th>' + (hasAmt ? '<th scope="col" class="r">' + esc(p.amountLabel || "Amount") + '</th>' : '') + p.cols.map(c => '<th scope="col">' + esc(c.label) + '</th>').join("") + '</tr></thead><tbody>';
  p.items.forEach((it, i) => {
    const fs = p.cols.map(c => p.fields.find(f => f.row === i && f.col === c.key));
    const msgs = [], shown = [];
    fs.forEach((f, k) => {
      if (!f) return;
      const r = s.fb && s.fb.res[f.id];
      if (s.revealed && s.shown[f.id]) { if (f.work) shown.push('<b>' + esc(p.cols[k].label) + ':</b> ' + esc(f.work)); }
      else if (r && !r.ok) msgs.push('<li><b>' + esc(p.cols[k].label) + ':</b> ' + esc(r.msg) + '</li>');
    });
    const fb = msgs.length ? '<div class="fb no"><ul>' + msgs.join("") + '</ul></div>' : shown.length ? '<div class="fb shown">' + [...new Set(shown)].join("<br>") + '</div>' : "";
    h += '<tr' + (fb ? ' class="has-fb"' : '') + '><td class="item">' + (p.numbered ? '<b>' + (i + 1) + '.</b> ' : '') + esc(it.text) + '</td>' + (hasAmt ? '<td class="amt">' + (it.amount != null ? "$" + fmt(it.amount) : "") + '</td>' : '') +
      fs.map((f, k) => '<td class="sel">' + (f ? control(p, f, s, lock, p.cols[k].label + " for " + it.text) : "") + '</td>').join("") + '</tr>';
    if (fb) h += '<tr class="fbrow"><td colspan="' + span + '">' + fb + '</td></tr>';
  });
  h += '</tbody></table></div>';
  const extra = p.fields.filter(f => f.row == null);
  return extra.length ? h + '<div style="margin-top:12px">' + listHTML(p, s, lock, extra) + '</div>' : h;
}
// A journal entry: each line is an account choice and an amount in the Debit or Credit column.
function jeHTML(p, s, lock) {
  const F = id => p.fields.find(x => x.id === id);
  let h = '<div class="scroll"><table class="jtab"><thead><tr><th scope="col">Account</th><th scope="col" class="r">Debit</th><th scope="col" class="r">Credit</th></tr></thead><tbody>';
  p.lines.forEach((ln, k) => {
    const fa = F(ln.a), fv = F(ln.v); if (!fa || !fv) return;
    const side = ln.side === "Cr" ? "Credit" : "Debit";
    const msgs = [], shown = [];
    [[fa, "Account"], [fv, "Amount"]].forEach(([f, lab]) => {
      const r = s.fb && s.fb.res[f.id];
      if (s.revealed && s.shown[f.id]) { if (f.work && lab === "Account") shown.push(esc(f.work)); }
      else if (r && !r.ok) msgs.push('<li><b>' + lab + ':</b> ' + esc(r.msg) + '</li>');
    });
    const fb = msgs.length ? '<div class="fb no"><ul>' + msgs.join("") + '</ul></div>' : shown.length ? '<div class="fb shown">' + shown.join("<br>") + '</div>' : "";
    const amt = control(p, fv, s, lock, side + " amount, line " + (k + 1));
    h += '<tr class="jl ' + (ln.side === "Cr" ? "cr" : "dr") + (fb ? " has-fb" : "") + '"><td class="acct">' + control(p, fa, s, lock, side + " account, line " + (k + 1)) + '</td><td class="amt">' + (ln.side === "Cr" ? "" : amt) + '</td><td class="amt">' + (ln.side === "Cr" ? amt : "") + '</td></tr>';
    if (fb) h += '<tr class="fbrow"><td colspan="3">' + fb + '</td></tr>';
  });
  return h + '</tbody></table></div>';
}
// A schedule with several amount columns (Q1, Q2, Total): sched.cols names them and each line has cells,
// each a field ({f}), a given amount ({v}) or nothing (null).
function gridHTML(p, s, lock, hl) {
  const S = p.sched, F = id => p.fields.find(x => x.id === id), n = S.cols.length;
  let h = '<div class="sched"><div class="stitle">' + S.title.map((l, i) => i === 0 ? '<div>' + esc(l) + '</div>' : '<small>' + esc(l) + '</small>').join("") + '</div><div class="scroll"><table class="stab grid"><thead><tr><th scope="col"></th>' + S.cols.map(c => '<th scope="col" class="r">' + esc(c) + '</th>').join("") + '</tr></thead><tbody>';
  S.lines.forEach(ln => {
    const ind = ln.ind ? " ind" + ln.ind : "", cells = ln.cells || [];
    if (ln.t === "head") { h += '<tr class="head"><td class="lbl' + ind + '">' + esc(ln.label) + '</td>' + '<td class="c e"></td>'.repeat(n) + '</tr>'; return; }
    const fs = cells.map(c => c && c.f ? F(c.f) : null), msgs = [];
    let state = "";
    fs.forEach((f, k) => {
      if (!f) return;
      const r = s.fb && s.fb.res[f.id];
      if (r && !r.ok && !(s.revealed && s.shown[f.id])) msgs.push('<li><b>' + esc(S.cols[k]) + ':</b> ' + esc(r.msg) + '</li>');
    });
    const hit = hl && fs.some(f => f && hl.indexOf(f.id) >= 0);
    h += '<tr class="' + (ln.t || "line") + (hit ? " hl" : "") + (msgs.length ? " has-fb" : "") + '"><td class="lbl' + ind + '">' + esc(ln.label) + '</td>' +
      cells.map((c, k) => !c ? '<td class="c e"></td>' : c.f ? '<td class="c">' + control(p, fs[k], s, lock, ln.label + ", " + S.cols[k]) + '</td>' : '<td class="c gv">' + esc(typeof c.v === "number" ? (c.u ? fmt(c.v) : "$" + fmt(c.v)) : String(c.v)) + '</td>').join("") + '</tr>';
    if (msgs.length) h += '<tr class="fbrow"><td colspan="' + (n + 1) + '"><div class="fb no"><ul>' + msgs.join("") + '</ul></div></td></tr>';
  });
  return h + '</tbody></table></div></div>';
}
function schedHTML(p, s, lock, hl) {
  const S = p.sched;
  if (S.cols) return gridHTML(p, s, lock, hl);
  let h = '<div class="sched"><div class="stitle">' + S.title.map((l, i) => i === 0 ? '<div>' + esc(l) + '</div>' : '<small>' + esc(l) + '</small>').join("") + '</div><table class="stab"><tbody>';
  S.lines.forEach(ln => {
    const ind = ln.ind ? " ind" + ln.ind : "";
    if (ln.t === "head") { h += '<tr class="head"><td class="lbl' + ind + '">' + esc(ln.label) + '</td><td class="c e"></td><td class="c e"></td></tr>'; return; }
    if (ln.t === "given") { const v = '$' + fmt(ln.v); h += '<tr class="given"><td class="lbl' + ind + '">' + esc(ln.label) + '</td><td class="c">' + (ln.col === 1 ? v : '') + '</td><td class="c">' + (ln.col === 2 ? v : '') + '</td></tr>'; return; }
    const f = p.fields.find(x => x.id === ln.f); if (!f) return;
    const r = s.fb && s.fb.res[f.id], c = cls(s, f), bad = r && !r.ok && !(s.revealed && s.shown[f.id]);
    const inp = control(p, f, s, lock, ln.label || f.label);
    h += '<tr class="' + (ln.t || "line") + c + (hl && hl.indexOf(f.id) >= 0 ? " hl" : "") + (bad ? " has-fb" : "") + '" data-row="' + esc(f.id) + '"><td class="lbl' + ind + '">' + esc(ln.label || f.label) + '</td><td class="c' + (ln.col === 1 ? '' : ' e') + '">' + (ln.col === 1 ? inp : '') + '</td><td class="c' + (ln.col === 2 ? '' : ' e') + '">' + (ln.col === 2 ? inp : '') + '</td></tr>';
    if (bad) h += '<tr class="fbrow"><td colspan="3"><div class="fb no">' + esc(r.msg) + '</div></td></tr>';
  });
  return h + '</tbody></table></div>';
}
function walkSteps(p) { return p.walk && p.walk.length ? p.walk : p.fields.map(f => ({ keys: [f.id], text: f.label + ": " + (f.work || "") })); }
function controls(primary) {
  let nav;
  if (graded()) nav = '<button class="btn small" data-act="exitGraded" title="Your graded attempt is saved to your account, and you can come back to it. The clock keeps running.">Exit to practice</button>';
  else nav = '<button class="btn small" data-act="back"' + (cur === 0 ? " disabled" : "") + '>← Back</button>';
  return '<div class="actions"><div class="grp">' + nav + '</div><div class="grp">' + primary + '</div></div>';
}
function renderPart() {
  if (graded() && GS.atEnd) { renderGradedDone(); return; }
  const p = PARTS[cur], s = st[cur], lock = !!s.status;
  $("partH").textContent = "Your work";
  const ph = PH[p.phase] || { i: 0, label: "" };
  const walking = !graded() && s.walk >= 0 ? walkSteps(p) : null;
  const hl = walking ? walking[s.walk].keys : null;
  let h = '<div class="meta"><span class="pill ph-' + (ph.i % 3) + '">Part ' + (cur + 1) + ' of ' + PARTS.length + '</span><span>' + esc(ph.label) + '</span></div>' +
    '<h3 class="part-title">' + esc(p.title) + '</h3>' + (p.desc ? '<p class="part-desc">' + esc(p.desc) + '</p>' : '') + '<!--fields-->';
  h += p.layout === "table" ? tableHTML(p, s, lock) : p.layout === "sched" ? schedHTML(p, s, lock, hl) : p.layout === "je" ? jeHTML(p, s, lock) : listHTML(p, s, lock);
  if (walking) {
    const w = walking[s.walk];
    h += '<div class="walk" role="region" aria-label="Walk-through"><div class="wtitle">Step ' + (s.walk + 1) + ' of ' + walking.length + '</div><p>' + esc(w.text) + (w.formula ? '<span class="formula">' + esc(w.formula) + '</span>' : '') + '</p>' +
      '<div class="actions"><div class="grp"><button class="btn small" data-act="walkBack"' + (s.walk === 0 ? " disabled" : "") + '>Back</button><button class="btn small" data-act="walkEnd">Close</button></div><div class="grp"><button class="btn primary" data-act="walkNext">' + (s.walk === walking.length - 1 ? "Finish" : "Next step") + '</button></div></div></div>';
  }
  if (!graded()) {
    if (s.revealed && s.walk < 0) h += '<div class="overall shown"><b>' + (s.status === "shown" ? "Answers shown." : "Walk-through closed.") + '</b> Work through each answer, then click Clear and try it on your own, or try new numbers.</div>';
    else if (s.fb && !s.revealed) {
      if (s.fb.all) h += '<div class="overall ok"><b>✓ ' + (s.tries === 1 ? "Correct on the first try." : "Correct after " + s.tries + " tries.") + '</b></div>';
      else { const n = Object.values(s.fb.res).filter(x => !x.ok).length; h += '<div class="overall no"><b>Not quite yet.</b> Fix the ' + (n === 1 ? "answer" : n + " answers") + ' marked ✗ and check again.</div>'; }
    }
  }
  if (lock && p.why) h += '<div class="why"><b>Why it matters</b><br>' + esc(p.why) + '</div>';
  if (!graded() && !lock && p.hint && s.tries >= 2) h += '<div class="hintbox"><b>Hint:</b> ' + esc(p.hint) + '</div>';
  let prim;
  const allDone = st.every(x => x.status);
  if (lock) {
    prim = '<button class="btn small" data-act="clear">Clear</button>';
    if (cur < PARTS.length - 1) prim += '<button class="btn primary" data-act="next">Next part →</button>';
    else if (allDone) prim += '<button class="btn primary" data-act="newset">New numbers →</button>';
    else prim += '<button class="btn primary" data-act="todo">Go to the unfinished part →</button>';
  } else prim = (walking ? '' : '<button class="btn gold small" data-act="walk">Walk me through it</button><button class="btn small" data-act="show">Show answers</button>') +
    '<button class="btn small" data-act="clear">Clear</button><button class="btn primary" data-act="check">Check answers</button>';
  if (!graded() && allDone && cur === PARTS.length - 1) {
    const c = x => st.filter(v => v.status === x).length;
    h += '<div class="effects"><span class="eff up">First try ' + c("first") + '</span><span class="eff none">Retried ' + c("retry") + '</span><span class="eff none">Answer shown ' + c("shown") + '</span></div>';
  }
  $("part").innerHTML = graded() ? gPartCard(h, s, lock) : h.replace("<!--fields-->", "") + controls(prim);
  $("partSub").textContent = lock ? (s.status === "shown" ? "Answers shown" : "Complete") : "Enter your answers";
}
function fill(p, s, ids) { ids.forEach(id => { const f = p.fields.find(x => x.id === id); if (!f) return; s.vals[id] = isSel(f) ? f.ans : (typeof f.ans === "number" ? f.ans.toLocaleString("en-US", { maximumFractionDigits: 4 }) : String(f.ans)); s.shown[id] = true; }); }
$("part").addEventListener("click", e => {
  const b = e.target.closest("[data-act]"); if (!b || b.disabled) return;
  const act = b.dataset.act, s = st[cur], p = PARTS[cur];
  if (act === "exitGraded") { exitGraded(); render(); scrollPart(); return; }
  if (graded()) {
    if (BUSY) return;
    if (act === "check") submitPart();
    else if (act === "finishG") finishGraded();
    else if (act === "next" && s.status) { cur++; render(); scrollPart(); gFocus(); }
    return;
  }
  if (act === "check") {
    s.tries++; s.fb = L.grade(p, s.vals);
    if (s.fb.all) s.status = s.revealed ? "shown" : s.tries === 1 ? "first" : "retry";
    render();
    const bad = $("part").querySelector(".no input,.no select,select.no"); if (bad) bad.focus(); else focusAct("next");
  } else if (act === "show") { s.walk = -1; s.revealed = true; s.status = "shown"; s.fb = null; fill(p, s, p.fields.map(f => f.id)); render(); focusAct("next"); }
  else if (act === "walk") { s.vals = {}; s.shown = {}; s.fb = null; s.revealed = true; s.walk = 0; fill(p, s, walkSteps(p)[0].keys); render(); focusAct("walkNext"); }
  else if (act === "walkNext") {
    const W = walkSteps(p);
    if (s.walk >= W.length - 1) { s.walk = -1; s.status = "shown"; fill(p, s, p.fields.map(f => f.id)); render(); focusAct("next") || focusAct("newset"); return; }
    s.walk++; fill(p, s, W[s.walk].keys); render(); focusAct("walkNext");
  } else if (act === "walkBack" && s.walk > 0) {
    walkSteps(p)[s.walk].keys.forEach(id => { delete s.vals[id]; delete s.shown[id]; }); s.walk--; render(); focusAct("walkNext");
  } else if (act === "walkEnd") { s.walk = -1; render(); }
  else if (act === "clear") { st[cur] = blank(); render(); const f = $("part").querySelector("input,select"); if (f) f.focus({ preventScroll: true }); }
  else if (act === "next") { cur++; render(); scrollPart(); const f = $("part").querySelector("input:not([disabled]),select:not([disabled])"); if (f) f.focus({ preventScroll: true }); }
  else if (act === "back") { cur--; render(); scrollPart(); }
  else if (act === "todo") { cur = st.findIndex(x => !x.status); render(); scrollPart(); }
  else if (act === "newset") { let sd = randomSeed(); if (sd === seed) sd++; buildSet(sd); render(); scrollPart(); }
});
function focusAct(a) { const p = $("part").querySelector('[data-act="' + a + '"]'); if (p) { p.focus({ preventScroll: true }); return true; } return false; }
function onField(e) {
  const el = e.target; if (!el.dataset || !el.dataset.f) return;
  const s = st[cur], id = el.dataset.f; s.vals[id] = el.value; delete s.shown[id];
  if (s.fb && s.fb.res[id]) {
    delete s.fb.res[id];
    el.classList.remove("ok", "no", "shown");
    const ib = el.closest(".inbox"); if (ib) ib.classList.remove("ok", "no", "shown");
    const w = el.closest(".field"); if (w) { w.className = "field"; const m = w.querySelector(".fmsg"); if (m) m.remove(); }
    const tr = el.closest("tr"); if (tr && tr.dataset.row) tr.classList.remove("ok", "no", "shown");
  }
  save();
}
$("part").addEventListener("input", onField);
$("part").addEventListener("change", onField);
$("part").addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.matches("input")) {
    e.preventDefault();
    if (graded() && !GS.done[cur]) return; // graded: submit only with the button
    const c = $("part").querySelector('[data-act="check"]'); if (c) c.click();
  }
});
function scrollPart() {
  const p = $("pPart"); const r = p.getBoundingClientRect(); const top = parseFloat(getComputedStyle(p).scrollMarginTop) || 0;
  if (r.top < top - 2 || r.top > window.innerHeight * 0.6) p.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

function render() {
  renderBar(); renderData(); renderPart(); save();
  const ct = document.querySelector(".tick.cur");
  if (ct) { const tl = $("timeline"); const cr = ct.getBoundingClientRect(), tr = tl.getBoundingClientRect(); if (cr.left < tr.left || cr.right > tr.right) tl.scrollLeft += cr.left - tr.left - tr.width / 2; }
}
function measure() { const r = document.documentElement; r.style.setProperty("--b1", $("band1").offsetHeight + "px"); r.style.setProperty("--b2", $("band2").offsetHeight + "px"); }
try { new ResizeObserver(measure).observe($("band1")); new ResizeObserver(measure).observe($("band2")); } catch (e) { window.addEventListener("resize", measure); }
measure();

load();
render();
// Graded mode: once the Supabase library has loaded (it is deferred), resume a graded attempt from the server,
// or reopen the Graded dialog after the student follows the sign-in link from their email.
(function () {
  const go = async () => {
    const fromEmail = /(^#|&)(access_token|error_description)=/.test(location.hash);
    if (PENDING) {
      const id = PENDING;
      try { if (!(await currentUser())) throw Object.assign(new Error("signed out"), { code: "unauthorized" }); await enterAttempt(id); }
      catch (e) {
        if (e && e.code === "not_found") { try { localStorage.removeItem(GKEY); } catch (x) { /* ignore */ } }
        PENDING = null; openGDlg(e && e.code === "unauthorized" ? "Sign in to resume your graded attempt." : e && e.message);
      }
      PENDING = null; save();
    } else if (fromEmail && COURSE) openGDlg();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go, { once: true }); else go();
})();
}
})();
