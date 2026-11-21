// Loads an ais/ page in jsdom with a mocked staff-chat server behind a mocked fetch.
// No network: external scripts are stripped, and window.supabase is a stub whose functions.invoke
// goes through the mocked fetch. Every request body is recorded in server.calls.
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const AIS = join(dirname(fileURLToPath(import.meta.url)), "..");
export const COURSE = "f1ecc575-f4d9-4894-b1c1-103a85c8e479";

const SIX = [
  ["jordan-banks", "Jordan Banks", "Sales Representative"], ["grace-liu", "Grace Liu", "Sales Manager"],
  ["ben-castellano", "Ben Castellano", "Warehouse Manager"], ["luis-ortega", "Luis Ortega", "Shipping Clerk"],
  ["elena-kowalczyk", "Elena Kowalczyk", "AR Specialist"], ["priya-raman", "Priya Raman", "Senior Accountant"],
];
const NORA = ["nora-feldman", "Nora Feldman", "HR and Payroll Coordinator"];

// A small fake of the staff-chat function. opts: ready, noraAvailable, includeAll (directory ignores group),
// faq (directory lists saved answers and the faq action works), faqError ({status, error, message}) for every
// faq call. s.sendError ({status, error, message}) applies to the next send.
export function makeServer(opts = {}) {
  const s = {
    calls: [], today: 3, convs: [], msgs: {}, n: 0,
    ready: opts.ready !== false, sendError: null,
    limits: { per_day: 120, per_conversation: 30, max_chars: 600 },
  };
  const FAQ = [
    { id: "faq-a", question: "What happens if I submit a lab late?", alternates: ["Can I turn in a lab late?"], section: "Late and missed work", answer: "Saved: late labs follow the rule under Late and missed work." },
    { id: "faq-b", question: "Can I use generative AI on my assignments?", alternates: [], section: "Generative Artificial Intelligence", answer: "Saved: the three levels of AI use are listed under Generative Artificial Intelligence." },
    { id: "faq-c", question: "When are office hours?", alternates: [], section: "Faculty Contact Information", answer: "Saved: office hours are listed under Faculty Contact Information." },
  ];
  s.faqCalls = 0;
  const norm = (t) => t.toLowerCase().replace(/\s+/g, " ").trim().replace(/[\s?.!]+$/, "");
  const bot = ([id, name, title], group) => ({ id, name, title, group, available: !(id === NORA[0] && opts.noraAvailable === false) });
  s.handle = (body) => {
    s.calls.push(body);
    const fail = (status, error, message) => ({ status, json: { error, message } });
    if (body.action === "directory") {
      const all = [...SIX.map((b) => bot(b, "interview")), bot(NORA, "hr")];
      const g = body.group || "interview";
      const bots = opts.includeAll ? all : all.filter((b) => b.group === g);
      const convs = opts.includeAll ? s.convs : s.convs.filter((c) => (c.bot === NORA[0]) === (g === "hr"));
      const json = { ready: s.ready, bots, conversations: convs, today: s.today, limits: s.limits };
      if (opts.personaLimit && g === "hr") { json.persona_used = s.personaUsed || 0; json.persona_limit = opts.personaLimit; }
      if (opts.faq && g === "hr") json.faq = FAQ.map(({ id, question, alternates, section }) => ({ id, question, alternates, section }));
      return { status: 200, json };
    }
    if (!s.ready) return fail(503, "not_configured", "The chat isn't switched on yet.");
    if (body.action === "start") {
      const b = [...SIX, NORA].find((x) => x[0] === body.bot);
      if (!b) return fail(400, "unknown_bot", "Unknown staff member.");
      const id = "0000000" + (++s.n) + "-aaaa-4bbb-8ccc-dddddddddddd";
      const c = { id, bot: b[0], name: b[1], title: b[2], assignment: body.assignment || null, started_at: "2027-01-27T15:04:00.000Z", student_messages: 0, card_version: "1.0" };
      s.convs.unshift(c); s.msgs[id] = [];
      return { status: 200, json: { conversation: { ...c }, today: s.today } };
    }
    if (body.action === "faq") {
      if (!opts.faq) return fail(400, "bad_action", "Unknown action.");
      if (opts.faqError) return fail(opts.faqError.status, opts.faqError.error, opts.faqError.message);
      const f = FAQ.find((x) => x.id === body.id);
      if (!f) return fail(404, "faq_not_found", "No saved answer.");
      s.faqCalls++;
      // Without a conversation, a saved answer is only logged (no conversation is created).
      if (!body.conversation_id) { s.faqViews = (s.faqViews || []).concat(f.id); return { status: 200, json: { entry: { id: f.id, question: f.question, answer: f.answer, section: f.section }, today: s.today } }; }
      const c = s.convs.find((x) => x.id === body.conversation_id);
      s.msgs[c.id].push({ role: "student", content: f.question, at: "2027-01-27T15:05:00.000Z" }, { role: "staff", source: "faq", section: f.section, content: f.answer, at: "2027-01-27T15:05:01.000Z" });
      return { status: 200, json: { entry: { id: f.id, question: f.question, answer: f.answer, section: f.section }, student_messages: c.student_messages, today: s.today } };
    }
    if (body.action === "send") {
      if (s.sendError) { const e = s.sendError; s.sendError = null; return fail(e.status, e.error, e.message); }
      const c = s.convs.find((x) => x.id === body.conversation_id);
      if (Array.from(body.message).length > 600) return fail(400, "too_long", "Too long.");
      const hit = opts.faq && !opts.faqError && FAQ.find((f) => [f.question, ...f.alternates].some((q) => norm(q) === norm(body.message)));
      if (hit) {
        s.msgs[c.id].push({ role: "student", content: body.message, at: "2027-01-27T15:05:00.000Z" }, { role: "staff", source: "faq", section: hit.section, content: hit.answer, at: "2027-01-27T15:05:01.000Z" });
        return { status: 200, json: { reply: hit.answer, source: "faq", section: hit.section, student_messages: c.student_messages, today: s.today } };
      }
      if (opts.personaLimit && c.bot === "nora-feldman" && (s.personaUsed || 0) >= opts.personaLimit) return fail(429, "persona_day_limit", "You've asked Nora 20 questions today. Saved answers still work, and the limit resets at midnight. For anything urgent, email Professor Goodwin.");
      if (opts.personaLimit && c.bot === "nora-feldman") s.personaUsed = (s.personaUsed || 0) + 1;
      const reply = "The syllabus section on late work explains this. Ask Professor Goodwin about any exception.";
      s.msgs[c.id].push({ role: "student", content: body.message, at: "2027-01-27T15:05:00.000Z" }, { role: "staff", content: reply, at: "2027-01-27T15:05:05.000Z" });
      c.student_messages++; s.today++;
      return { status: 200, json: { reply, student_messages: c.student_messages, today: s.today, ...(opts.personaLimit ? { persona_used: s.personaUsed } : {}) } };
    }
    if (body.action === "transcript") {
      const c = s.convs.find((x) => x.id === body.conversation_id);
      return { status: 200, json: { conversation: { ...c }, messages: s.msgs[c.id] } };
    }
    return fail(400, "bad_action", "Bad action.");
  };
  return s;
}

const tick = () => new Promise((r) => setTimeout(r, 0));
export async function settle(n = 8) { for (let i = 0; i < n; i++) await tick(); }

// page: "hr" or "staff". signedIn: whether getSession returns a user.
export async function loadPage(page, server, { query = "?course=" + COURSE, signedIn = true } = {}) {
  let html = readFileSync(join(AIS, page, "index.html"), "utf8");
  const js = readFileSync(join(AIS, page, page === "hr" ? "hr.js" : "staff.js"), "utf8");
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<link\b[^>]*>/gi, "");
  const dom = new JSDOM(html, { url: "https://rgoodwi3.github.io/interacctive/ais/" + page + "/" + query, runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  const downloads = [];
  w.URL.createObjectURL = (blob) => { downloads.push(blob); return "blob:mock/" + downloads.length; };
  w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function () { downloads.lastName = this.download; };
  // The mocked fetch: the only way a request leaves the page.
  w.fetch = async (url, init) => {
    const r = server.handle(JSON.parse(init.body));
    return { ok: r.status < 400, status: r.status, json: async () => r.json };
  };
  const user = { id: "u1", email: "student@example.edu" };
  w.supabase = {
    createClient: () => ({
      auth: {
        getSession: async () => ({ data: { session: signedIn ? { user } : null } }),
        signInWithOtp: async () => ({ error: null }),
        verifyOtp: async () => ({ data: { user }, error: null }),
        signOut: async () => ({}),
      },
      functions: {
        invoke: async (name, { body }) => {
          const res = await w.fetch("https://example.supabase.co/functions/v1/" + name, { method: "POST", body: JSON.stringify(body) });
          if (res.ok) return { data: await res.json(), error: null };
          return { data: null, error: { context: { status: res.status, json: res.json } } };
        },
      },
    }),
  };
  if (w.document.readyState !== "complete") await new Promise((r) => w.addEventListener("load", r, { once: true }));
  w.eval(js);
  await settle();
  return { dom, w, d: w.document, downloads };
}

export function type(w, el, text) { el.value = text; el.dispatchEvent(new w.Event("input", { bubbles: true })); }
export function enter(w, el, shift = false) { el.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Enter", shiftKey: shift, bubbles: true, cancelable: true })); }

// Clicks "Start chat" if the inline confirmation is showing (no-op otherwise).
export async function yes(d) { const c = d.getElementById("confirm"); if (c && !c.hidden) { d.getElementById("confirmYes").click(); await settle(); } }
