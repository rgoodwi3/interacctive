import { test } from "node:test";
import assert from "node:assert/strict";
import { makeServer, loadPage } from "./harness.mjs";

test("staff directory: shows only the six interview bots even if the server returns Nora", async () => {
  const s = makeServer({ includeAll: true });
  s.convs.push({ id: "22222222-aaaa-4bbb-8ccc-dddddddddddd", bot: "nora-feldman", name: "Nora Feldman", title: "HR and Payroll Coordinator", assignment: "HR", started_at: "2027-01-26T15:00:00Z", student_messages: 1 });
  s.convs.push({ id: "33333333-aaaa-4bbb-8ccc-dddddddddddd", bot: "grace-liu", name: "Grace Liu", title: "Sales Manager", assignment: "D1", started_at: "2027-01-26T16:00:00Z", student_messages: 2 });
  const { d } = await loadPage("staff", s, { query: "?course=f1ecc575-f4d9-4894-b1c1-103a85c8e479&for=D1" });
  const ids = [...d.querySelectorAll("#people button")].map((b) => b.dataset.bot);
  assert.deepEqual(ids, ["jordan-banks", "grace-liu", "ben-castellano", "luis-ortega", "elena-kowalczyk", "priya-raman"]);
  assert.doesNotMatch(d.getElementById("app").textContent, /Nora/);
  assert.deepEqual([...d.querySelectorAll("#past button")].map((b) => b.dataset.conv), ["33333333-aaaa-4bbb-8ccc-dddddddddddd"]);
  assert.deepEqual(s.calls[0], { action: "directory", course_id: "f1ecc575-f4d9-4894-b1c1-103a85c8e479" }, "staff request unchanged");
});
