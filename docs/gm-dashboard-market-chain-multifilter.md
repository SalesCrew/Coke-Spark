# GM Dashboard: Multifilter Marktketten

The Admin GM Dashboard's existing chain controls allow simultaneous selection of:

- REWE: Billa, Billa+, ISP and ESP. Case and spaces are normalized; Billa Plus is an alias of Billa+.
- SPAR: Spar.
- Sonstige Märkte: every other value, including missing chain names. Billa Corso and distribution centres remain in this group.

Multiple groups form a union. An empty selection means all markets. Region, GM, market and date restrictions still intersect that union. Changing the groups clears the selected market and narrows the market dropdown to the same union. Each existing card retains its own filter controls, including availability and cooler inventory. Customer access uses the same GM Dashboard page and existing permissions.

The read-only query accepts optional `chainGroups: ("rewe" | "spar" | "other")[]`. Older clients can continue sending the exact `chain` field. Group subsets do not receive whole-GM archived/corrected IPP replacements. Excel exports record the selected group names and use the filtered card results. No database migration is required.

## Verification

- 9 backend tests passed: PostgreSQL/HTTP grouping unions, normalized and unknown names, combined filters, validation, draft/deleted exclusion, backward compatibility, IPP replacement guard and existing dashboard data regressions.
- 25 frontend tests passed: group mapping/labels, deployment contract parity and existing dashboard date/chart/empty-state regressions. Run `npm run test:gm-dashboard` with the backend dependencies available.
- Backend production TypeScript build and frontend production build checked before release.
- Browser E2E used actual production dashboard components and the production HTTP query handler against disposable PGlite data. REWE + SPAR gave five visits and 90% availability across IPP, availability, cooler inventory, placements and activity. SPAR alone gave one visit; other markets gave three; reset restored eight. Market options contained only the chosen groups, and changing groups cleared the selected Billa market.
- A real browser Excel download was read back: all five filter sheets contained `REWE, SPAR`, and activity contained five visits. Browser reported no runtime errors.
- Disposable browser preview entry points were removed from the checkout before the production build. They never loaded production environment settings or a production database connector.

Release uses the existing master integrations: `SalesCrew/Spark-Backend` on Railway first, followed by `SalesCrew/Coke-Spark` on Vercel with the updated backend gitlink.
