import { test } from "node:test";
import assert from "node:assert/strict";
import { makeServer, loadPage, settle } from "./harness.mjs";

test("staff directory: shows only the six interview bots even if the server returns Nora", async () => {
  const s = makeServer({ includeAll: true });
  s.convs.push({ id: "22222222-aaaa-4bbb-8ccc-dddddddddddd", bot: "nora-feldman", name: "Nora Feldman", title: "HR and Payroll Coordinator", assignment: "HR", started_at: "2027-01-26T15:00:00Z", student_messages: 1 });
  s.convs.push({ id: "33333333-aaaa-4bbb-8ccc-dddddddddddd", bot: "grace-liu", name: "Grace Liu", title: "Sales Manager", assignment: "D1", started_at: "2027-01-26T16:00:00Z", student_messages: 2 });
  const { d } = await loadPage("staff", s, { query: "?course=f1ecc575-f4d9-4894-b1c1-103a85c8e479&for=D1" });
  const ids = [...d.querySelectorAll("#people button")].map((b) => b.dataset.bot);
  assert.deepEqual(ids, ["jordan-banks", "grace-liu", "ben-castellano", "luis-ortega", "elena-kowalczyk", "priya-raman"]);
  assert.doesNotMatch(d.getElementById("people").textContent, /Nora/);
  assert.deepEqual([...d.querySelectorAll("#past button")].map((b) => b.dataset.conv), ["33333333-aaaa-4bbb-8ccc-dddddddddddd"]);
  assert.deepEqual(s.calls[0], { action: "directory", course_id: "f1ecc575-f4d9-4894-b1c1-103a85c8e479" }, "staff request unchanged");
});

test("staff directory: Nora is a separate link to the HR page, never a chat here", async () => {
  const s = makeServer({ includeAll: true });
  const { d } = await loadPage("staff", s, { query: "?course=f1ecc575-f4d9-4894-b1c1-103a85c8e479&for=D1" });
  const a = d.getElementById("hrLink");
  assert.equal(a.tagName, "A");
  assert.equal(a.getAttribute("href"), "../hr/?course=f1ecc575-f4d9-4894-b1c1-103a85c8e479");
  assert.equal(a.getAttribute("aria-label"), "Ask HR: Nora Feldman, HR and Payroll Coordinator, on the HR help desk page");
  assert.match(a.textContent, /Nora Feldman/); assert.match(a.textContent, /Ask HR/);
  assert.equal(a.querySelector("img").getAttribute("alt"), "");
  assert.equal(a.querySelector("img").getAttribute("src"), "../hr/nora-feldman-240.png");
  assert.equal(d.getElementById("hrH").textContent, "Questions about Company Policies?");
  assert.equal(a.closest("#people"), null, "not in the interview list");
  a.click(); await settle();
  assert.equal(s.calls.filter((c) => c.action === "start").length, 0);
  assert.equal(d.getElementById("confirm").hidden, true);
});

test("staff directory: confirm before a new interview; Cancel and Escape return focus; Start chat starts", async () => {
  const s = makeServer();
  const { w, d } = await loadPage("staff", s, { query: "?course=f1ecc575-f4d9-4894-b1c1-103a85c8e479&for=D2" });
  const conf = d.getElementById("confirm"), grace = d.querySelector('#people button[data-bot="grace-liu"]');
  const starts = () => s.calls.filter((c) => c.action === "start");
  grace.click(); await settle();
  assert.equal(conf.hidden, false);
  assert.equal(d.getElementById("confirmH").textContent, "Start a new chat with Grace Liu, Sales Manager?");
  assert.equal(d.getElementById("confirmP").textContent, "This starts a new saved conversation for D2. You can download its transcript at any time.");
  assert.equal(d.activeElement.id, "confirmH");
  assert.equal(starts().length, 0);
  assert.equal(d.getElementById("ask").hidden, true, "the chat window doesn't open yet");
  d.getElementById("confirmNo").click();
  assert.equal(conf.hidden, true); assert.equal(d.activeElement, grace); assert.equal(starts().length, 0);
  grace.click(); await settle();
  conf.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(conf.hidden, true); assert.equal(d.activeElement, grace); assert.equal(starts().length, 0);
  grace.click(); d.getElementById("confirmYes").click(); await settle();
  assert.deepEqual(starts()[0], { action: "start", course_id: "f1ecc575-f4d9-4894-b1c1-103a85c8e479", bot: "grace-liu", assignment: "D2" });
  assert.equal(d.getElementById("ask").hidden, false);
  assert.equal(d.activeElement.id, "msg");
  // "New conversation with this person" confirms too.
  const restart = d.getElementById("restart");
  restart.click(); await settle();
  assert.equal(conf.hidden, false); assert.match(d.getElementById("confirmH").textContent, /Grace Liu/);
  d.getElementById("confirmNo").click();
  assert.equal(d.activeElement, restart); assert.equal(starts().length, 1);
  restart.click(); d.getElementById("confirmYes").click(); await settle();
  assert.equal(starts().length, 2);
});

test("staff directory: no FOR tag gives the plain confirmation line", async () => {
  const s = makeServer();
  const { d } = await loadPage("staff", s);
  d.querySelector('#people button[data-bot="jordan-banks"]').click(); await settle();
  assert.equal(d.getElementById("confirmP").textContent, "This starts a new saved conversation. You can download its transcript at any time.");
});
