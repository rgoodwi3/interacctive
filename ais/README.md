# ACCT 2250 InterACCtive labs (subject "ais")

Pages for the five ACCT 2250 Accounting Information Systems labs live here, one folder per lab:

| Lab | Folder | Server slug |
| --- | --- | --- |
| IL1 Order-to-Cash Trail | `ais/o2c-trail/` | `ais-o2c-trail` |
| IL2 Procure-to-Pay and the Three-Way Match | `ais/p2p-match/` | `ais-p2p-match` |
| IL3 Internal Control | `ais/internal-control/` | `ais-internal-control` |
| IL4 Keys, Relationships and Cardinality | `ais/keys-cardinality/` | `ais-keys-cardinality` |
| IL5 IT General Controls and Cyber | `ais/itgc-cyber/` | `ais-itgc-cyber` |

`frame.css` and `frame.js` start as copies of `ma/frame.css` and `ma/frame.js` (Nov 17, 2026). Build spec: ACCT2250-InterACCtive-Lab-Specs.md in the instructor's OneDrive (ACCT 2250 \ 10 InterACCtive). Running company: Trailhead Outfitters Co. (fictional).

This branch stays unmerged until the first lab passes its parity test and the full platform test suite.

## Trailhead staff directory (`ais/staff/`)

Students interview the six order-to-cash staff chatbots for D1, D2 and M1 (chatbot spec step SC5). `index.html`, `staff.js` and `staff.css` are the student page; open it from Canvas as `ais/staff/?course=<class id>&for=D1` (`for` is D1, D2 or M1 and tags the conversation). `instructor.html?course=<class id>` exports transcripts for the class instructor. Both talk only to the `staff-chat` function and the `staff_chat_transcripts` RPC in `rgoodwi3/fa-lab-platform`. The staff cards never come to this repository: names, titles and replies arrive from the server after sign-in.

## HR help desk (`ais/hr/`)

Students ask Nora Feldman, Trailhead's HR and Payroll Coordinator, about the Company Policies (the course syllabus). Open it from Canvas as `ais/hr/?course=<class id>`. The page uses the same `staff-chat` function with bot `nora-feldman` and the tag `HR`, and asks the `directory` action for the `hr` group. Nora never appears in the staff directory: `ais/staff/` shows only the six interview staff. Nora's instructions and the policy text stay on the server. Her picture is `nora-feldman-240.png`; if the file is missing, the page hides it.

## Tests (`ais/tests/`)

jsdom tests for the HR page and the staff directory filter, with a mocked server: `cd ais/tests && npm install && npm test`. Set `PRIVATE_DIR` to the course's private folder (the course root or its `10 InterACCtive/staff-chat` folder) to add the text-leak scan.
