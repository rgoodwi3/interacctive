import { test } from "node:test";
import assert from "node:assert/strict";
import { makeServer, loadPage, settle, type, enter } from "./harness.mjs";

const sends = (s) => s.calls.filter((c) => c.action === "send");
const starts = (s) => s.calls.filter((c) => c.action === "start");

test("directory asks for the hr group; the page shows Nora's help desk", async () => {
  const s = makeServer();
  const { d } = await loadPage("hr", s);
  assert.deepEqual(s.calls[0], { action: "directory", course_id: "f1ecc575-f4d9-4894-b1c1-103a85c8e479", group: "hr" });
  assert.equal(d.getElementById("app").hidden, false);
  assert.equal(d.getElementById("alert").hidden, true);
  assert.equal(d.querySelector("h1").textContent, "Ask HR: Company Policies");
  assert.match(d.querySelector(".hr-who").textContent, /Nora Feldman, HR and Payroll Coordinator/);
  assert.equal(d.getElementById("avatar").getAttribute("alt"), "", "decorative: the name is printed beside it");
  assert.equal(d.getElementById("avatar").getAttribute("src"), "nora-feldman-240.png");
  assert.equal(d.body.classList.contains("ignore-color-scheme"), true);
  assert.equal(d.getElementById("download").disabled, true, "no transcript before a conversation exists");
  assert.equal(starts(s).length, 0, "no empty conversation is created on load");
  assert.match(d.getElementById("usage").textContent, /3 of 120/);
});

test("Enter starts a conversation with nora-feldman tagged HR, sends, and announces the reply", async () => {
  const s = makeServer();
  const { w, d } = await loadPage("hr", s);
  const msg = d.getElementById("msg");
  type(w, msg, "What happens if I submit a lab late?");
  enter(w, msg, true);   // Shift+Enter: new line, no send
  await settle();
  assert.equal(sends(s).length, 0);
  enter(w, msg);
  await settle();
  assert.equal(starts(s).length, 1);
  assert.deepEqual(starts(s)[0], { action: "start", course_id: "f1ecc575-f4d9-4894-b1c1-103a85c8e479", bot: "nora-feldman", assignment: "HR" });
  assert.equal(sends(s).length, 1);
  assert.equal(sends(s)[0].message, "What happens if I submit a lab late?");
  assert.deepEqual(Object.keys(sends(s)[0]).sort(), ["action", "conversation_id", "message"], "send carries no name, email or history");
  assert.equal(d.getElementById("announce").textContent, "Nora Feldman says: The syllabus section on late work explains this. Ask Professor Goodwin about any exception.");
  assert.equal(d.getElementById("log").getAttribute("aria-live"), "off");
  assert.equal(d.getElementById("log").querySelectorAll(".sc-msg").length, 2);
  assert.equal(msg.value, "");
  assert.match(d.getElementById("usage").textContent, /4 of 120\. This conversation: 1 of 30\./);
  assert.equal(d.getElementById("past").querySelectorAll("button").length, 1);
  // A second question reuses the conversation.
  type(w, msg, "And a quiz?"); enter(w, msg); await settle();
  assert.equal(starts(s).length, 1);
  assert.equal(sends(s).length, 2);
  assert.equal(sends(s)[1].conversation_id, starts(s).length && s.convs[0].id);
});

test("600-character limit: the counter flags 601 and nothing is sent", async () => {
  const s = makeServer();
  const { w, d } = await loadPage("hr", s);
  const msg = d.getElementById("msg");
  assert.equal(msg.getAttribute("maxlength"), "600");
  type(w, msg, "x".repeat(601));
  assert.equal(d.getElementById("msgCount").textContent, "601 of 600 characters");
  assert.equal(d.getElementById("msgCount").classList.contains("over"), true);
  enter(w, msg); await settle();
  assert.equal(starts(s).length + sends(s).length, 0);
  assert.match(d.getElementById("alert").textContent, /600 characters or fewer/);
  type(w, msg, "é".repeat(600));   // counted in characters, not bytes
  enter(w, msg); await settle();
  assert.equal(sends(s).length, 1);
});

test("starter buttons fill the box and send", async () => {
  const s = makeServer();
  const { d } = await loadPage("hr", s);
  const btns = [...d.querySelectorAll("#starters button")];
  assert.ok(btns.length >= 3 && btns.length <= 4);
  btns[0].click(); await settle();
  assert.equal(starts(s)[0].bot, "nora-feldman");
  assert.equal(sends(s)[0].message, btns[0].dataset.q);
  assert.equal(btns[0].textContent, btns[0].dataset.q);
});

test("transcript download is plain text from the server's copy", async () => {
  const s = makeServer();
  const { w, d, downloads } = await loadPage("hr", s);
  type(w, d.getElementById("msg"), "Can I use generative AI on my assignments?"); enter(w, d.getElementById("msg")); await settle();
  assert.equal(d.getElementById("download").disabled, false);
  d.getElementById("download").click(); await settle();
  assert.equal(downloads.length, 1);
  const text = await new Promise((r) => { const fr = new w.FileReader(); fr.onload = () => r(fr.result); fr.readAsText(downloads[0]); });
  assert.match(text, /^Trailhead HR help desk: Company Policies \(simulation\)\r\n/);
  assert.match(text, /HR contact: Nora Feldman, HR and Payroll Coordinator/);
  assert.match(text, /Student: student@example\.edu/);
  assert.match(text, /Conversation ID: 00000001-aaaa-4bbb-8ccc-dddddddddddd \(card 1\.0\)/);
  assert.match(text, /The syllabus is the final word\./);
  assert.match(text, /\] You: Can I use generative AI on my assignments\?/);
  assert.match(text, /\] Nora Feldman: The syllabus section on late work/);
  assert.match(downloads.lastName, /^trailhead-hr-nora-feldman-2027-01-27-00000001\.txt$/);
});

test("not switched on: message shown, sending and starters disabled, nothing started", async () => {
  for (const opts of [{ ready: false }, { noraAvailable: false }]) {
    const s = makeServer(opts);
    const { w, d } = await loadPage("hr", s);
    assert.match(d.getElementById("alert").textContent, /HR help desk isn't switched on yet/);
    assert.equal(d.getElementById("send").disabled, true);
    assert.equal(d.getElementById("msg").disabled, true);
    assert.ok([...d.querySelectorAll("#starters button")].every((b) => b.disabled));
    d.querySelector("#starters button").click();
    type(w, d.getElementById("msg"), "Hello"); enter(w, d.getElementById("msg")); await settle();
    assert.equal(starts(s).length + sends(s).length, 0);
    assert.ok(!d.querySelector(".hr-help").closest("[hidden]") && /203-932-7333/.test(d.querySelector(".hr-help").textContent));
  }
});

test("an old server that ignores group: only Nora and her conversations are used", async () => {
  const s = makeServer({ includeAll: true });
  s.convs.push({ id: "11111111-aaaa-4bbb-8ccc-dddddddddddd", bot: "grace-liu", name: "Grace Liu", title: "Sales Manager", assignment: "D1", started_at: "2027-01-26T15:00:00Z", student_messages: 2 });
  const { d } = await loadPage("hr", s);
  assert.equal(d.getElementById("past").children.length, 0);
  assert.equal(d.getElementById("pastNone").hidden, false);
});

test("errors: server limit message shown and the question kept; card change starts fresh; expired sign-in", async () => {
  const s = makeServer();
  const { w, d } = await loadPage("hr", s);
  const msg = d.getElementById("msg");
  type(w, msg, "First"); enter(w, msg); await settle();
  s.sendError = { status: 429, error: "day_limit", message: "You've reached today's limit of 120 messages. It resets at midnight." };
  type(w, msg, "Second"); enter(w, msg); await settle();
  assert.equal(d.getElementById("alert").textContent, "You've reached today's limit of 120 messages. It resets at midnight.");
  assert.equal(msg.value, "Second");
  assert.equal(d.getElementById("log").querySelectorAll(".sc-msg").length, 2, "the failed question is removed from the log");
  s.sendError = { status: 409, error: "card_changed", message: "Nora's instructions were updated." };
  enter(w, msg); await settle();
  assert.match(d.getElementById("alert").textContent, /updated\. Press Send again to ask in a new conversation\./);
  enter(w, msg); await settle();
  assert.equal(starts(s).length, 2);
  s.sendError = { status: 401, error: "x", message: "x" };
  type(w, msg, "Third"); enter(w, msg); await settle();
  assert.equal(d.getElementById("signin").hidden, false);
  assert.match(d.getElementById("alert").textContent, /sign-in has expired/);
  assert.ok(!d.querySelector(".hr-help").closest("[hidden]"), "crisis info visible on the sign-in screen too");
});

test("no course in the link: clear message, no calls", async () => {
  const s = makeServer();
  const { d } = await loadPage("hr", s, { query: "" });
  assert.match(d.getElementById("alert").textContent, /Open the HR help desk from the link in Canvas/);
  assert.equal(s.calls.length, 0);
});

test("signed out: sign-in form, then the code signs in and loads the help desk", async () => {
  const s = makeServer();
  const { w, d } = await loadPage("hr", s, { signedIn: false });
  assert.equal(d.getElementById("signin").hidden, false);
  assert.equal(d.activeElement.id, "email");
  d.getElementById("email").value = "student@example.edu";
  d.getElementById("emailForm").requestSubmit(); await settle();
  d.getElementById("code").value = "123456";
  d.getElementById("codeForm").requestSubmit(); await settle();
  assert.equal(d.getElementById("app").hidden, false);
  assert.equal(d.activeElement.id, "msg");
});

test("accessibility: one H1, headings in order, every control labelled, live regions", async () => {
  const s = makeServer();
  const { w, d } = await loadPage("hr", s);
  type(w, d.getElementById("msg"), "How do I ask for an accommodation?"); enter(w, d.getElementById("msg")); await settle();
  const hs = [...d.querySelectorAll("h1,h2,h3,h4,h5,h6")];
  assert.equal(hs.filter((h) => h.tagName === "H1").length, 1);
  assert.equal(hs[0].tagName, "H1");
  let prev = 1;
  for (const h of hs) { const lv = +h.tagName[1]; assert.ok(lv <= prev + 1, "heading skips a level: " + h.textContent); prev = lv; }
  for (const b of d.querySelectorAll("button")) assert.ok((b.getAttribute("aria-label") || b.textContent).trim(), "button without a name");
  for (const f of d.querySelectorAll("input,textarea,select")) assert.ok(d.querySelector('label[for="' + f.id + '"]') || f.getAttribute("aria-label"), "unlabelled field " + f.id);
  assert.equal(d.getElementById("status").getAttribute("role"), "status");
  assert.equal(d.getElementById("alert").getAttribute("role"), "alert");
  assert.equal(d.getElementById("announce").getAttribute("aria-live"), "polite");
  assert.equal(d.documentElement.getAttribute("lang"), "en");
  for (const img of d.querySelectorAll("img")) assert.ok(img.hasAttribute("alt"));
  assert.ok(d.querySelector("a.skip[href='#main']") && d.getElementById("main"));
  // The simulation and privacy notes are visible text.
  const sim = d.querySelector(".sc-sim").textContent;
  assert.match(sim, /This is a simulation/);
  assert.match(sim, /saved to your class account, and Professor Goodwin can read them/);
  assert.match(sim, /Anthropic\) without your name or email/);
  assert.match(sim, /Don't share health or personal details here/);
  assert.match(sim, /anything you type goes with them/);
  // Crisis and support information is always on the page, in every state.
  const help = d.querySelector(".hr-help");
  assert.equal(help.getAttribute("role"), "note");
  assert.match(help.textContent, /No one reads this chat as it happens\./);
  assert.match(help.textContent, /Counseling & Psychological Services \(CAPS\) at 203-932-7333; CAPS offers 24\/7 crisis support\./);
  assert.match(help.textContent, /University Police at 203-932-7070 or 911\./);
  assert.ok(!help.closest("[hidden]"));
  assert.doesNotMatch(d.querySelector(".sc-foot").textContent, /time limit/);
  assert.match(d.querySelector(".hr-intro").textContent, /syllabus is the final word.*can't grant exceptions, extensions or grade changes.*Professor Goodwin/s);
});

const faqs = (s) => s.calls.filter((c) => c.action === "faq");

test("saved answers: a starter with a saved answer calls faq (no model), labels it and shows its section", async () => {
  const s = makeServer({ faq: true });
  const { w, d, downloads } = await loadPage("hr", s);
  assert.match(d.getElementById("startHint").textContent, /saved answer from HR/);
  const late = d.querySelector('#starterList button[data-q="What happens if I submit a lab late?"]');
  assert.equal(late.dataset.faq, "faq-a");
  assert.equal(d.querySelector('#starterList button[data-q="What is a lab defense, and how is it graded?"]').dataset.faq, undefined, "no saved answer: asks Nora");
  // Saved answers not on a starter are listed after them.
  const more = [...d.querySelectorAll("#faqList button")];
  assert.equal(d.getElementById("faqList").hidden, false);
  assert.deepEqual(more.map((b) => b.dataset.faq), ["faq-c"]);
  late.click(); await settle();
  assert.equal(starts(s).length, 1);
  assert.deepEqual(faqs(s)[0], { action: "faq", conversation_id: s.convs[0].id, id: "faq-a" });
  assert.equal(sends(s).length, 0, "no model call");
  const reply = d.querySelector("#log .sc-msg.faq");
  assert.match(reply.querySelector("h3").textContent, /^Nora Feldman, saved answer from HR, /);
  assert.equal(reply.querySelector(".hr-src").textContent, "Section: Late and missed work");
  assert.equal(d.getElementById("announce").textContent, "Saved answer from HR, section Late and missed work: Saved: late labs follow the rule under Late and missed work.");
  assert.match(d.getElementById("usage").textContent, /3 of 120\. This conversation: 0 of 30\./, "saved answers don't count against model limits");
  more[0].click(); await settle();
  assert.equal(faqs(s).length, 2); assert.equal(starts(s).length, 1);
  d.getElementById("download").click(); await settle();
  const text = await new Promise((r) => { const fr = new w.FileReader(); fr.onload = () => r(fr.result); fr.readAsText(downloads[0]); });
  assert.match(text, /\] Nora Feldman \(saved answer from HR; section: Late and missed work\): Saved: late labs/);
  // Reopening shows saved answers with their label.
  d.getElementById("restart").click(); d.querySelector("#past button").click(); await settle();
  assert.equal(d.querySelectorAll("#log .sc-msg.faq").length, 2);
});

test("saved answers: a typed question the server matches comes back labelled as saved", async () => {
  const s = makeServer({ faq: true });
  const { w, d } = await loadPage("hr", s);
  type(w, d.getElementById("msg"), "can I turn in a lab late"); enter(w, d.getElementById("msg")); await settle();
  assert.equal(sends(s).length, 1);
  assert.equal(d.querySelectorAll("#log .sc-msg.faq").length, 1);
  assert.match(d.getElementById("announce").textContent, /^Saved answer from HR, section Late and missed work: /);
});

test("fallback: no saved-answer list means starters ask Nora", async () => {
  const s = makeServer();
  const { d } = await loadPage("hr", s);
  assert.equal(d.getElementById("faqList").hidden, true);
  assert.ok([...d.querySelectorAll("#starterList button")].every((b) => !b.dataset.faq));
  d.querySelector("#starterList button").click(); await settle();
  assert.equal(faqs(s).length, 0);
  assert.equal(sends(s).length, 1);
});

test("fallback: faq action unavailable or stale sends the question to Nora instead", async () => {
  for (const [err, turnsOff] of [[{ status: 400, error: "bad_action", message: "Unknown action." }, true], [{ status: 409, error: "faq_stale", message: "Out of date." }, false]]) {
    const s = makeServer({ faq: true, faqError: err });
    const { d } = await loadPage("hr", s);
    d.querySelector('#starterList button[data-faq="faq-a"]').click(); await settle(12);
    assert.equal(faqs(s).length, 1);
    assert.equal(sends(s).length, 1);
    assert.equal(sends(s)[0].message, "What happens if I submit a lab late?");
    assert.equal(d.getElementById("alert").hidden, true, "no error shown");
    assert.equal(d.querySelectorAll("#log .sc-msg").length, 2, "one question, one reply from Nora");
    assert.equal(d.querySelector("#log .sc-msg.faq"), null);
    assert.equal(d.getElementById("faqList").hidden, turnsOff);
  }
});

test("saved answers: a limit error from faq is shown, not hidden behind a fallback", async () => {
  const s = makeServer({ faq: true, faqError: { status: 429, error: "rate_limited", message: "Too many questions in a minute. Try again in a minute." } });
  const { d } = await loadPage("hr", s);
  d.querySelector('#starterList button[data-faq="faq-a"]').click(); await settle();
  assert.equal(sends(s).length, 0);
  assert.equal(d.getElementById("alert").textContent, "Too many questions in a minute. Try again in a minute.");
});
