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
  assert.equal(d.getElementById("avatar").getAttribute("alt"), "Nora Feldman");
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
  assert.equal(d.getElementById("starters").hidden, true);
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
  assert.match(d.querySelector(".hr-intro").textContent, /syllabus is the final word.*can't grant exceptions, extensions or grade changes.*Professor Goodwin/s);
});
