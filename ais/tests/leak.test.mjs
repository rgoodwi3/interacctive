// Leak scan of the public HR page files. Always checks for "INSTRUCTOR", G/D/R codes and Lab Q3.
// With PRIVATE_DIR set to the instructor folder (…/ACCT 2250), it also checks that no 8-word run from the
// staff cards, the HR card/template/grounding or the syllabus text appears in a public file. Review files are
// skipped: they quote proposed page wording on purpose.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { AIS } from "./harness.mjs";

const PUBLIC = ["hr/index.html", "hr/hr.js", "hr/hr.css", "README.md", "staff/staff.js", "staff/instructor.html", "staff/instructor.js", "tests/leak.test.mjs", "tests/harness.mjs", "tests/hr.test.mjs", "tests/staff-filter.test.mjs"].map((f) => join(AIS, f));
const words = (t) => t.toLowerCase().replace(/<[^>]+>/g, " ").match(/[a-z0-9']+/g) || [];
// Staff names and bot ids are public (the pages show them), so a run made only of names doesn't count.
const NAMES = new Set("jordan banks grace liu ben castellano luis ortega elena kowalczyk priya raman nora feldman".split(" "));
const shingles = (t, n = 8) => { const w = words(t), s = new Set(); for (let i = 0; i + n <= w.length; i++) { const run = w.slice(i, i + n); if (!run.every((x) => NAMES.has(x))) s.add(run.join(" ")); } return s; };

test("no INSTRUCTOR, no G/D/R codes, no Lab Q3 in the HR page files", () => {
  for (const f of PUBLIC.slice(0, 3)) {
    const t = readFileSync(f, "utf8");
    assert.doesNotMatch(t, /INSTRUCTOR/, f);
    assert.doesNotMatch(t, /\b[GDR]\d{1,2}\b/, f);
    assert.doesNotMatch(t, /\bQ3\b/, f);
  }
});

test("no card, template or syllabus text in public files", { skip: !process.env.PRIVATE_DIR && "set PRIVATE_DIR to run" }, () => {
  // PRIVATE_DIR may be the ACCT 2250 folder or its "10 InterACCtive/staff-chat" folder.
  let P = process.env.PRIVATE_DIR.replace(/[\\/]+$/, "");
  if (!existsSync(join(P, "10 InterACCtive")) && existsSync(join(P, "..", "..", "10 InterACCtive", "staff-chat"))) P = join(P, "..", "..");
  const sources = [];
  const sc = join(P, "10 InterACCtive", "staff-chat");
  for (const dir of [sc, join(sc, "hr")]) if (existsSync(dir)) for (const f of readdirSync(dir)) if (/_INSTRUCTOR\.md$/.test(f) && !/REVIEW_INSTRUCTOR/.test(f) && statSync(join(dir, f)).isFile()) sources.push([f, readFileSync(join(dir, f), "utf8")]);
  const syl = join(P, "01 Syllabus and Planning", "ACCT2250_6641_Syllabus_Spring2027_DRAFT.docx");
  if (existsSync(syl)) sources.push(["syllabus", execFileSync("unzip", ["-p", syl, "word/document.xml"]).toString("utf8").replace(/<\/w:p>/g, "\n")]);
  assert.ok(sources.length >= 8 && sources.some(([n]) => n === "syllabus"), "PRIVATE_DIR must be the ACCT 2250 folder (holding '10 InterACCtive' and '01 Syllabus and Planning') or its '10 InterACCtive/staff-chat' folder");
  // ais/README.md: only the HR and tests sections (the lab table above them lists public lab titles the syllabus also uses).
  const pubText = (f) => { const t = readFileSync(f, "utf8"); return f.endsWith("README.md") ? t.slice(t.indexOf("## HR help desk")) : t; };
  const pub = PUBLIC.map((f) => [f, shingles(pubText(f))]);
  // The page's starter questions are public by design (the saved-answer file repeats them word for word): drop them first.
  const page = readFileSync(join(AIS, "hr/index.html"), "utf8");
  const starters = [...page.matchAll(/data-q="([^"]+)"/g)].map((m) => m[1]);
  // The "Need help now?" sentences were written for the page (a90164f); the HR test script quotes them to test Nora.
  const help = (page.match(/<div class="hr-help"[\s\S]*?<\/div>/) || [""])[0].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").split(/(?<=[.;?])\s+/).map((x) => x.trim().replace(/[.;?]$/, "")).filter((x) => x.split(" ").length >= 4);
  starters.push(...help);
  let checked = 0;
  for (const [name, raw] of sources) { const text = starters.reduce((t, q) => t.split(q.toLowerCase()).join(" "), raw.toLowerCase()); for (const s of shingles(text)) { checked++; for (const [f, set] of pub) assert.ok(!set.has(s), `${name} text in ${f}: "${s}"`); } }
  console.log("leak scan: " + checked + " eight-word fragments from " + sources.length + " private files; none found");
});
