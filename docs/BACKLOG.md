# Horizon Improvement Backlog

## Approved

### Holdings
- [x] **1. Watchlist UI** — WatchlistItem model exists, needs: server actions (CRUD), watchlist page/section, target buy price display, add-from-holdings button
- [x] **2. Refactor PositionDetailSheet** — Split 500+ line component into CostSection, DividendSection, ValuationSection, CompanySection sub-components
- [x] **4. Grouping mode** — Group holdings by account, sector, or asset class with collapsible sections
- [x] **5. Total dividends received** — Sum DIVIDEND transactions per position, show in detail sheet
### Accounts
- [x] **6. Account sparkline charts** — Mini charts on account cards showing value over time
- [x] **7. Cash balance tracking** — Compute uninvested cash per account (deposits − buys + sells − withdrawals), show on account cards
- [x] **8. Account reordering** — Drag-to-reorder via @dnd-kit/react, persist via orderIndex field
- [x] ~~**9. Account type breakdown summary**~~ — Skipped (not useful with few accounts per type)

### Transactions
- [x] **10. Duplicate transaction detection** — Warn before saving if a similar transaction (same account, security, type, date, amount) already exists, with "Save anyway" override
- [x] **11. Default date filter to last 3 months** — Default `filterDateFrom` to 90 days ago, clear chip to see all time

### Contributions
- [x] **12. CRCD holdings management UI** — Manage individual CRCD tranches (purchase year, quantity, redemption date, tax credit) from existing CRCDHolding model
- [x] **13. Savings goal trend chart** — Bar chart showing goal vs actual deposits per year

### Retirement
- [x] **14. Remove dead `contributionAllocation` field** — Drop unused JSON field from Scenario model + migration

### Infrastructure
- [x] **15. Auto-fetch prices on login** — Trigger price + FX fetch when user logs in if data is stale (> 4 hours)
- [x] **16. Error boundaries + 404 page** — Add error.tsx at locale level + not-found.tsx with friendly UI

---

## Low Priority / Later
- [ ] **3. Column visibility toggle** — Dropdown/popover on holdings table to show/hide columns, persist in localStorage
- [ ] Cash position on dashboard (after #7)
- [ ] CSV export for transactions
- [ ] Scenario side-by-side comparison view
- [ ] RRIF/RRMD minimum withdrawal modeling
