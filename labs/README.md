# Financial accounting labs

These 12 labs were merged here from their own repos on 2026-11-18, with git history kept. Each folder name matches the lab's `slug` in the Supabase `activities` table.

**This folder is now the source of truth.** Make lab edits here, not in the old repos.

## Cutover status

- [x] Copied (identical files): served at `https://rgoodwi3.github.io/interacctive/labs/<slug>/`
- [ ] Tuesday release: point `activities.url` at the new paths
- [ ] Same release: replace each old repo's `index.html` with a redirect to the new path (keeping `?course=` and `#…`), so existing Canvas links keep working
- [ ] Check that the sign-in email link returns students to the new path (Supabase Auth redirect URLs)
- [ ] After the semester: archive the old repos

| Old repo | New folder |
|---|---|
| AR-Allowances | ar-allowances |
| Long-Term-Assets | long-term-assets |
| Notes-Journal-Entries | notes-journal-entries |
| TVM-Bonds | tvm-bonds |
| Elements-of-Accounting | elements-of-accounting |
| Accounting_Cycle_Lab | accounting-cycle-lab |
| Bank-Reconciliation | bank-reconciliation |
| Inventory-Journal-Entries | inventory-journal-entries |
| Multistep-Income-Statement | multistep-income-statement |
| Inventory-Cost-Flows | inventory-cost-flows |
| Stock-Entries | stock-entries |
| Cash-Flows | cash-flows |
