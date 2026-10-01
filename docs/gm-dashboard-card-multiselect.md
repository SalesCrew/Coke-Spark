# GM admin dashboard: multiple chains and markets

The existing filters stay on each card with the original labels, appearance and layout. Chain and Market now support multiple selections in the same dropdown. Clicking a second option keeps the first; clicking a selected option removes it. The dropdown stays open until clicking outside or pressing Escape.

Chain groups use the requested mapping: REWE includes Billa, Billa+, ISP and ESP; SPAR includes Spar; Sonstige Märkte includes everything else. Multiple groups form a union, as do multiple market IDs. Chain, Market, Region and GM filters combine by intersection. Adding another group preserves selected compatible markets; removing a group removes markets outside the remaining selection. Empty selections mean all; the existing reset clears both selections.

The optional chainGroups and marketIds fields preserve legacy single-chain and single-market API requests. All cards, including both availability filters and the activity filter modal, pass their own selections to the read-only dashboard query. The Excel export records each card's selected groups and market IDs. Subset queries do not use a whole-GM archived IPP value.

Verification uses disposable PGlite databases, synthetic visits and the real HTTP dashboard handler. Browser verification runs the real card components and Excel exporter against that isolated handler with synthetic authentication. The isolated frontend copy has no production environment files. No production database connections, data queries, writes, migrations or background-job entry points are used for tests or deployment verification.
