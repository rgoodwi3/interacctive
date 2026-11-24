/* Built from fa-lab-platform/supabase/functions/_shared/labs/topics.js by build-topics.mjs. Don't edit by hand. */
(function () {
"use strict";
// The concepts in each lab, for instructors who assign only some of them.
//
// Each lab lists its concepts (key and the label instructors see) and of(step), which names the concept a
// step belongs to, or null for a step that is always shown (the stock lab's closing entries, done for you).
// A step whose concept isn't assigned is "done for you": the student sees it filled in with the correct
// answer, it is worth no points, and the ledgers and story stay the same as in the full lab.
//
// This file is plain JavaScript so the server (lab-attempt) and the browser share it word for word:
// build-topics.mjs wraps it for the pages as interacctive/topics.js (window.IAC_TOPICS), and
// topics.test.ts checks that copy matches. Edit this file, then rebuild the page copy.

const by = (field, map) => (s) => (Object.hasOwn(map, s[field]) ? map[s[field]] : null);
const ids = (pairs) => by("id", Object.fromEntries(pairs.flatMap(([key, list]) => list.map((id) => [id, key]))));

const TOPICS = {
  "ar-allowances": {
    topics: [
      { key: "credit", label: "Sales, services and collections" },
      { key: "returns", label: "Sales returns" },
      { key: "pct", label: "Percent of credit sales method" },
      { key: "writeoff", label: "Write-offs" },
      { key: "recovery", label: "Recovering a written-off account" },
      { key: "aging", label: "Aging of receivables" },
      { key: "bs", label: "Balance sheet presentation" },
    ],
    of(s) {
      if (s.phase === "est1") return "pct";
      if (s.phase === "est2") return "aging";
      if (s.phase === "bs") return "bs";
      if (s.kind === "Sales return") return "returns";
      if (s.kind === "Write-off") return "writeoff";
      if (/^Recovery/.test(s.kind || "")) return "recovery";
      return "credit";
    },
  },
  "long-term-assets": {
    topics: [
      { key: "purchase", label: "Asset purchases" },
      { key: "cost", label: "Capitalizing an asset's cost" },
      { key: "basket", label: "Basket purchase" },
      { key: "intangible", label: "Patents and copyrights" },
      { key: "goodwill", label: "Goodwill" },
      { key: "repairs", label: "Repairs vs. improvements" },
      { key: "disposal", label: "Disposals: trade-in, scrap and sale" },
      { key: "dep", label: "Year-end depreciation" },
      { key: "amort", label: "Year-end amortization" },
      { key: "impair", label: "Impairment" },
      { key: "bs", label: "Balance sheet presentation" },
    ],
    of(s) {
      const k = s.kind || "";
      if (k === "Capitalize or expense" || (k === "Asset purchase" && s.ref === "3")) return "cost";
      if (k === "Asset purchase") return "purchase";
      if (k === "Basket purchase") return "basket";
      if (k === "Internally created intangible" || k === "Purchased intangible") return "intangible";
      if (k === "Business acquisition") return "goodwill";
      if (k === "Repairs or improvement" || k === "Ordinary repairs" || k === "Capital expenditure") return "repairs";
      if (/^Disposal/.test(k)) return "disposal";
      if (k === "Depreciation schedule" || (k === "Adjusting entry" && s.ref === "13")) return "dep";
      if (k === "Amortization schedule" || (k === "Adjusting entry" && s.ref === "14")) return "amort";
      if (/^Impairment/.test(k)) return "impair";
      if (s.phase === "rep") return "bs";
      return null;
    },
  },
  "notes-journal-entries": {
    topics: [
      { key: "nr", label: "Notes receivable: issuing and collecting" },
      { key: "np", label: "Notes payable: issuing and paying" },
      { key: "accrue", label: "Accruing interest at year-end" },
      { key: "bs", label: "Balance sheet presentation" },
      { key: "y2", label: "Collecting and paying notes after year-end" },
    ],
    of(s) {
      if (s.phase === "ye") return "accrue";
      if (s.phase === "rep") return "bs";
      if (s.phase === "y2") return "y2";
      const k = s.kind || "";
      if (k === "Service on account" || /^Note (receivable|collected)/.test(k)) return "nr";
      if (k === "Purchase on account" || /^Note (payable|paid)/.test(k)) return "np";
      return null;
    },
  },
  "tvm-bonds": {
    topics: [
      { key: "fv", label: "Future value of a single sum" },
      { key: "pv", label: "Present value of a single sum" },
      { key: "fva", label: "Future value of an annuity" },
      { key: "pva", label: "Present value of an annuity" },
      { key: "mixed", label: "Mixed practice: choosing the approach" },
      { key: "issue", label: "Bond issue price and issuance" },
      { key: "amort", label: "Effective-interest amortization and interest payments" },
      { key: "bs", label: "Balance sheet presentation" },
    ],
    of(s) {
      if (s.phase === "tvm") return ({ FV: "fv", PV: "pv", FVA: "fva", PVA: "pva", Mixed: "mixed" })[s.ref] || null;
      if (s.phase === "bond") return "issue";
      if (s.phase === "pay") return "amort";
      if (s.phase === "rep") return "bs";
      return null;
    },
  },
  "stock-entries": {
    topics: [
      { key: "common", label: "Issuing common stock (cash, services, land)" },
      { key: "preferred", label: "Issuing preferred stock" },
      { key: "treasury", label: "Treasury stock" },
      { key: "arrears", label: "Dividends in arrears" },
      { key: "cashdiv", label: "Cash dividends" },
      { key: "stockdiv", label: "Stock dividends" },
      { key: "split", label: "Stock splits" },
      { key: "equity", label: "Stockholders' equity section" },
    ],
    of(s) {
      const k = s.kind || "";
      if (s.type === "info") return null;
      if (/^Issue common stock/.test(k)) return "common";
      if (k === "Issue preferred stock") return "preferred";
      if (/treasury stock/i.test(k)) return "treasury";
      if (k === "Dividends in arrears") return "arrears";
      if (k === "Dividend allocation" || /cash dividend/.test(k)) return "cashdiv";
      if (k === "Small stock dividend") return "stockdiv";
      if (k === "Stock split") return "split";
      if (s.phase === "rep") return "equity";
      return null;
    },
  },
  "inventory-journal-entries": {
    topics: [
      { key: "basic", label: "Service business transactions" },
      { key: "purchase", label: "Inventory purchases, freight and payment" },
      { key: "purchret", label: "Purchase returns and allowances" },
      { key: "sale", label: "Sales and cost of goods sold" },
      { key: "salesret", label: "Sales returns and allowances" },
      { key: "lcm", label: "Lower of cost or market" },
      { key: "adj", label: "Other year-end adjustments" },
    ],
    of(s) {
      const k = s.kind || "";
      if (k === "Basic transaction") return "basic";
      if (/^Inventory · (purchase return|purchase allowance)/.test(k)) return "purchret";
      if (/^Inventory · (purchase|freight-in|payment)/.test(k)) return "purchase";
      if (/^Inventory · (sales return|sales allowance)/.test(k)) return "salesret";
      if (/^Inventory · (sale|collection)/.test(k)) return "sale";
      if (k === "Adjusting · lower of cost or market") return "lcm";
      if (/^Adjusting/.test(k)) return "adj";
      return null;
    },
  },
  "accounting-cycle-lab": {
    topics: [
      { key: "basic", label: "Recording transactions" },
      { key: "accrual", label: "Accruals" },
      { key: "deferral", label: "Deferrals" },
      { key: "dep", label: "Depreciation" },
      { key: "close", label: "Closing entries" },
    ],
    of(s) {
      if (s.phase === "basic") return "basic";
      if (s.phase === "close") return "close";
      const k = s.kind || "";
      if (/^Accrual/.test(k)) return "accrual";
      if (/^Deferral/.test(k)) return "deferral";
      if (k === "Depreciation") return "dep";
      return null;
    },
  },
  "bank-reconciliation": {
    topics: [
      { key: "match", label: "Comparing the cash records with the bank statement" },
      { key: "sort", label: "Classifying reconciling items" },
      { key: "rec", label: "Preparing the bank reconciliation" },
      { key: "je", label: "Journal entries from the reconciliation" },
      { key: "error", label: "Correcting a book error" },
      { key: "bs", label: "Reporting cash on the balance sheet" },
    ],
    of(s) {
      if (s.type === "match") return "match";
      if (s.type === "sort") return "sort";
      if (s.phase === "rec") return "rec";
      if (s.kind === "Book error correction") return "error";
      if (s.phase === "je") return "je";
      if (s.phase === "rep") return "bs";
      return null;
    },
  },
  "cash-flows": {
    topics: [
      { key: "chg", label: "Changes in the balance sheet accounts" },
      { key: "cls", label: "Classifying operating, investing and financing items" },
      { key: "op", label: "Operating activities (indirect method)" },
      { key: "inv", label: "Investing activities" },
      { key: "fin", label: "Financing activities" },
      { key: "sum", label: "Net change in cash and noncash activities" },
      { key: "q", label: "Interpreting the statement" },
    ],
    of: ids([["chg", ["chg"]], ["cls", ["cls"]], ["op", ["op"]], ["inv", ["inv"]], ["fin", ["fin"]], ["sum", ["sum"]], ["q", ["q"]]]),
  },
  "inventory-cost-flows": {
    topics: [
      { key: "setup", label: "Goods available for sale and units sold" },
      { key: "fifo", label: "FIFO" },
      { key: "lifo", label: "LIFO" },
      { key: "wa", label: "Weighted average" },
      { key: "gp", label: "Gross profit and comparing the methods" },
    ],
    of: ids([["setup", ["avail", "sold"]], ["fifo", ["fifo"]], ["lifo", ["lifo"]], ["wa", ["wa"]], ["gp", ["gp"]]]),
  },
  "multistep-income-statement": {
    topics: [
      { key: "p1", label: "Which statement each account goes on" },
      { key: "p2", label: "Income statement sections" },
      { key: "p3", label: "Naming the subtotals" },
      { key: "p4", label: "Reading the statement" },
    ],
    of: ids([["p1", ["p1"]], ["p2", ["p2"]], ["p3", ["p3"]], ["p4", ["p4"]]]),
  },
  "elements-of-accounting": {
    topics: [
      { key: "fin", label: "Financing: stock, loans and dividends" },
      { key: "inv", label: "Investing: buying and selling equipment" },
      { key: "op", label: "Operating: revenue, expenses, receivables and payables" },
      { key: "adj", label: "Adjusting entries" },
    ],
    of(s) {
      if (/^A/.test(s.ref || "")) return "adj";
      const k = s.kind || "";
      if (k === "Issue stock" || k === "Borrow" || k === "Repay principal" || k === "Pay dividends") return "fin";
      if (k === "Buy equipment" || k === "Sell equipment") return "inv";
      return "op";
    },
  },

  // ---------- managerial: one concept per part, except where parts belong together ----------
  "ma-foundations": {
    topics: [
      { key: "users", label: "Users of managerial accounting" },
      { key: "functions", label: "Planning, directing and controlling" },
      { key: "costs", label: "Classifying costs" },
      { key: "totals", label: "Totaling product and period costs" },
    ],
    of: ids([["users", ["users"]], ["functions", ["functions"]], ["costs", ["costs"]], ["totals", ["totals"]]]),
  },
  "ma-cogm": {
    topics: [
      { key: "flows", label: "Manufacturing cost flows" },
      { key: "cogm", label: "Schedule of cost of goods manufactured" },
      { key: "is", label: "Manufacturer's income statement" },
      { key: "types", label: "Service, merchandising and manufacturing companies" },
    ],
    of: ids([["flows", ["flows"]], ["cogm", ["cogm"]], ["is", ["is"]], ["types", ["types"]]]),
  },
  "ma-job-order-costing": {
    topics: [
      { key: "rate", label: "Predetermined overhead rate" },
      { key: "jobs", label: "Job cost sheets" },
      { key: "status", label: "Where the jobs are at year-end" },
      { key: "ohvar", label: "Over- and underapplied overhead" },
      { key: "je", label: "Journal entries" },
      { key: "adj", label: "Adjusted cost of goods sold" },
    ],
    of: ids([["rate", ["rate"]], ["jobs", ["jobs"]], ["status", ["status"]], ["ohvar", ["ohvar"]], ["je", ["je1", "je2", "je3", "je4", "je5", "je6"]], ["adj", ["adj"]]]),
  },
  "ma-process-costing": {
    topics: [
      { key: "units", label: "Physical units" },
      { key: "eu", label: "Equivalent units" },
      { key: "rate", label: "Cost per equivalent unit" },
      { key: "assign", label: "Assigning costs" },
      { key: "bind", label: "A second department (transferred-in costs)" },
      { key: "je", label: "Journal entries" },
    ],
    of: ids([["units", ["units"]], ["eu", ["eu"]], ["rate", ["rate"]], ["assign", ["assign"]], ["bind", ["bind"]], ["je", ["je1", "je2", "je3", "je4"]]]),
  },
  "ma-activity-based-costing": {
    topics: [
      { key: "trad", label: "Traditional costing: one plantwide rate" },
      { key: "drivers", label: "Activities and cost drivers" },
      { key: "rates", label: "Activity rates" },
      { key: "abcCost", label: "Product costs under ABC" },
      { key: "compare", label: "Comparing the methods and deciding" },
    ],
    of: ids([["trad", ["trad"]], ["drivers", ["drivers"]], ["rates", ["rates"]], ["abcCost", ["abcCost"]], ["compare", ["compare"]]]),
  },
  "ma-cost-behavior": {
    topics: [
      { key: "classify", label: "Classifying cost behavior" },
      { key: "perunit", label: "Total vs. per-unit costs" },
      { key: "highlow", label: "The high-low method" },
      { key: "cm", label: "Contribution margin income statement" },
      { key: "absorb", label: "Variable vs. absorption costing" },
    ],
    of: ids([["classify", ["classify"]], ["perunit", ["perunit"]], ["highlow", ["highlow"]], ["cm", ["cm"]], ["absorb", ["absorb"]]]),
  },
  "ma-cvp": {
    topics: [
      { key: "cm", label: "Contribution margin" },
      { key: "be", label: "Breakeven point" },
      { key: "target", label: "Target profit" },
      { key: "whatif", label: "What-if analysis" },
      { key: "mix", label: "Sales mix" },
      { key: "safety", label: "Margin of safety and operating leverage" },
    ],
    of: ids([["cm", ["cm"]], ["be", ["be"]], ["target", ["target"]], ["whatif", ["whatif"]], ["mix", ["mix"]], ["safety", ["safety"]]]),
  },
  "ma-short-term-decisions": {
    topics: [
      { key: "relevant", label: "Relevant costs and revenues" },
      { key: "special", label: "Special orders" },
      { key: "make", label: "Make or buy" },
      { key: "drop", label: "Keep or drop a product line" },
      { key: "process", label: "Sell or process further" },
      { key: "constraint", label: "Constrained resources" },
    ],
    of: ids([["relevant", ["relevant"]], ["special", ["special"]], ["make", ["make"]], ["drop", ["drop"]], ["process", ["process"]], ["constraint", ["constraint"]]]),
  },
  "ma-capital-budgeting": {
    topics: [
      { key: "payback", label: "Payback period" },
      { key: "arr", label: "Accounting rate of return" },
      { key: "tvm", label: "Time value of money" },
      { key: "npv", label: "Net present value" },
      { key: "irr", label: "Internal rate of return" },
      { key: "disagree", label: "When the methods disagree" },
    ],
    of: ids([["payback", ["payback"]], ["arr", ["arr"]], ["tvm", ["tvm"]], ["npv", ["npv"]], ["irr", ["irr"]], ["disagree", ["disagree"]]]),
  },
  "ma-master-budget": {
    topics: [
      { key: "sales", label: "Sales budget" },
      { key: "coll", label: "Expected cash collections" },
      { key: "prod", label: "Production budget" },
      { key: "mat", label: "Direct materials purchases budget" },
      { key: "pay", label: "Cash paid for materials" },
      { key: "labor", label: "Direct labor and overhead" },
      { key: "cash", label: "Cash budget" },
      { key: "is", label: "Budgeted income statement" },
    ],
    of: ids([["sales", ["sales"]], ["coll", ["coll"]], ["prod", ["prod"]], ["mat", ["mat"]], ["pay", ["pay"]], ["labor", ["labor"]], ["cash", ["cash"]], ["is", ["is"]]]),
  },
  "ma-variances": {
    topics: [
      { key: "flex", label: "Flexible budget" },
      { key: "vp", label: "Volume vs. performance variances" },
      { key: "card", label: "Standard cost card" },
      { key: "mat", label: "Direct materials variances" },
      { key: "lab", label: "Direct labor variances" },
      { key: "oh", label: "Overhead variances" },
      { key: "resp", label: "Who is responsible" },
    ],
    of: ids([["flex", ["flex"]], ["vp", ["vp"]], ["card", ["card"]], ["mat", ["mat"]], ["lab", ["lab"]], ["oh", ["oh"]], ["resp", ["resp"]]]),
  },
  "ma-performance-measures": {
    topics: [
      { key: "centers", label: "Responsibility centers" },
      { key: "ctl", label: "Controllable costs" },
      { key: "roi", label: "Return on investment" },
      { key: "ri", label: "Residual income" },
      { key: "eva", label: "Economic value added" },
      { key: "invest", label: "Will the manager invest?" },
      { key: "bsc", label: "Balanced scorecard" },
    ],
    of: ids([["centers", ["centers"]], ["ctl", ["ctl"]], ["roi", ["roi"]], ["ri", ["ri"]], ["eva", ["eva"]], ["invest", ["invest"]], ["bsc", ["bsc"]]]),
  },
  // ---------- accounting information systems (ACCT 2250): one concept per part ----------
  "ais-o2c-trail": {
    topics: [
      { key: "records", label: "Order-to-cash events and NetSuite records" },
      { key: "postings", label: "Standard postings for each record" },
      { key: "balances", label: "Effect on account balances" },
      { key: "web", label: "Web store cash sales and card settlement" },
    ],
    of: ids([["records", ["records"]], ["postings", ["postings"]], ["balances", ["balances"]], ["web", ["web"]]]),
  },
  "ais-p2p-match": {
    topics: [
      { key: "docs", label: "Reading the PO, receipt and bill" },
      { key: "match", label: "The three-way match and its tolerance" },
      { key: "pay", label: "Approving and posting a matched bill" },
      { key: "vendor", label: "Vendor master change requests" },
    ],
    of: ids([["docs", ["docs"]], ["match", ["match"]], ["pay", ["pay"]], ["vendor", ["vendor"]]]),
  },
  "ais-internal-control": {
    topics: [
      { key: "coso", label: "COSO components and principles" },
      { key: "fraud", label: "Fraud triangle and red flags" },
      { key: "classify", label: "Classifying controls" },
      { key: "sod", label: "Segregation of duties" },
      { key: "riskcontrol", label: "Matching controls to risks" },
    ],
    of: ids([["coso", ["coso"]], ["fraud", ["fraud"]], ["classify", ["classify"]], ["sod", ["sod"]], ["riskcontrol", ["riskcontrol"]]]),
  },
  "ais-keys-cardinality": {
    topics: [
      { key: "keys", label: "Primary and foreign keys" },
      { key: "card", label: "Cardinality from business rules" },
      { key: "fk", label: "Placing foreign keys" },
      { key: "link", label: "Linking tables and composite keys" },
      { key: "integrity", label: "Referential integrity and duplicate keys" },
    ],
    of: ids([["keys", ["keys"]], ["card", ["card"]], ["fk", ["fk"]], ["link", ["link"]], ["integrity", ["integrity"]]]),
  },
  "ais-itgc-cyber": {
    topics: [
      { key: "area", label: "IT general control areas" },
      { key: "deficiency", label: "ITGC deficiencies" },
      { key: "soc", label: "SOC reports and the controls Trailhead runs" },
      { key: "threats", label: "Cyber threats and controls" },
      { key: "nist", label: "NIST CSF 2.0 functions" },
    ],
    of: ids([["area", ["area"]], ["deficiency", ["deficiency"]], ["soc", ["soc"]], ["threats", ["threats"]], ["nist", ["nist"]]]),
  },
  "ais-sql-recon": {
    topics: [
      { key: "select", label: "Reading SELECT, WHERE and ORDER BY" },
      { key: "criteria", label: "Turning requests into criteria" },
      { key: "joins", label: "INNER and LEFT joins" },
      { key: "totals", label: "GROUP BY and HAVING" },
      { key: "recon", label: "Tying a query total to the trial balance" },
    ],
    of: ids([["select", ["select"]], ["criteria", ["criteria"]], ["joins", ["joins"]], ["totals", ["totals"]], ["recon", ["recon"]]]),
  },
};

// The assigned concepts as a clean list for this lab: only known keys, in catalog order. null means the
// whole lab (no list, an empty list, or every concept).
function cleanTopics(slug, list) {
  const def = TOPICS[slug];
  if (!def || !Array.isArray(list)) return null;
  const keep = def.topics.map((t) => t.key).filter((k) => list.includes(k));
  return keep.length && keep.length < def.topics.length ? keep : null;
}

// Whether a step is done for you under these assigned concepts (from cleanTopics).
function isGiven(slug, step, topics) {
  if (!topics) return false;
  const def = TOPICS[slug];
  const key = def ? def.of(step) : null;
  return key !== null && !topics.includes(key);
}

// A full-credit answer for a step, in the shape the page sends: what a done-for-you step shows as filled in.
function answerKey(step) {
  if (step.type === "entry") {
    return { rows: (step.lines || []).map((l) => ({ a: l.a, dr: l.dr ? String(l.dr) : "", cr: l.cr ? String(l.cr) : "" })) };
  }
  const vals = {};
  if (step.type === "match") {
    for (const r of (step.bookRows || []).concat(step.bankRows || [])) vals[r.id] = r.match ? "1" : "";
  } else if (step.type === "sort") {
    for (const it of step.items || []) vals[it.id] = String(it.ans);
  } else if (Array.isArray(step.e)) {
    step.e.forEach((r, i) => { vals["el" + i] = r.el; vals["dir" + i] = r.dir; vals["amt" + i] = String(r.amt); });
  } else {
    for (const f of step.fields || []) vals[f.id] = String(f.ans);
  }
  return { vals };
}

window.IAC_TOPICS = { TOPICS, cleanTopics, isGiven, answerKey };
})();
