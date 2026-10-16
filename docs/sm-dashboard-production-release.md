# SM dashboard production release — 2026-10-16

The user approved the selected localhost result and explicitly requested production deployment. This release is built on the current production revisions, retaining the already-shipped Durcharbeit SM exchange helper and GM market changes. No migration, configuration backfill, import or historical answer rewrite is needed or included.

## Released behavior

- One compact filter row with linked Region, Handelskette, Markt and SM choices and both dates; Markt remains the widest control. Standard reporting keeps Durcharbeit-only markets out while retaining genuine shared Stammmärkte and original historical visitors.
- Selected **Besuche im Fokus** presentation for activity and **Drei Zustände** for performance. All twelve figures use the same filtered scope, with actual accepted ZE, clear unavailable values, matching workbook export and preserved lower charts.
- Availability before → recovered share → after; the recovered share is of the whole, never relative growth. Coke Rot (`#f40009`) colors the before number/bar/swatch. Mint and recovered/final greens remain, with a sharp join, compact legend and one-line “Warenverfügbarkeit” heading without the shelf icon.
- Explicit Basistätigkeiten mapping in module creation/editing for all ten question types: Ja1, Teilweise0.5, Nein0, independent of answer wording. Metadata uses existing JSON and outcome-code storage, follows frozen questionnaire versions and future answer/correction paths, and does not relabel historical answers.

Canonical requirements/formulas: [metric specification](sm-dashboard-metrics-spec.md). Implementation/history: [living dashboard record](sm-dashboard-redesign-living.md), [filters](sm-dashboard-filters-2026-10-15.md), [visual choices](sm-dashboard-design-options.md).

## Exact release verification

A clean frontend/backend release copy was created from production masters `b27e9ce58df5e50b0ac772cd15dd0251dcaf7658` / `e533ca5c791ed2481ecf4237752f7bcbbc1e51f0`. Only the scoped dashboard/filter/authoring files and their tests/documentation were copied. Environment files, dependencies, build output and visual-preview artifacts are excluded.

- Backend production TypeScript build passed.
- Optimized frontend Webpack build and TypeScript passed with an explicitly synthetic4037 backend URL and no production environment files.
- Focused backend suite: **72 passed, zero failed/skipped** using fresh disposable PGlite databases and synthetic photo storage. Covers explicit mappings/all types, actual authoring→answer→submission→reporting, corrections, photo changes, immutable history, filters, accepted ZE revisions, exact paper arithmetic, existing lower OOS and employee-home behavior.
- Frontend filter/loading suite: **9 passed, zero failed/skipped**.
- Scoped Next/TypeScript ESLint passed using a temporary config matching the earlier task review; the existing set-state-in-effect rule exception stays limited to that external review config. No lint infrastructure change ships.
- The final component was rendered on the isolated actual app at1280/1440 laptop widths: one-line header, red number matching the before bar, fixed mint/recovery colors, no gradient or panel overflow. Earlier full filter/export/authoring browser evidence is recorded in the living record.
- The unrelated monthly weekly-profile failure recorded in the earlier living record was reproduced at untouched baseline; no profile logic is changed by this release.

## Delivery and boundaries

Backend commit: `d285f49499c4b8c9d3c2920ce4ed96c3ceea6c2f`, pushed to `SalesCrew/Spark-Backend:master`. Railway production target: project `52e48407-7116-44f8-94a7-f0123891881e`, environment `28d539cb-a359-4f9a-89f5-75fc347f4133`, service `5214a3c7-67fd-4422-8141-3ccd98c80fff`. Deployment `f0df07b3-90f4-436f-a467-5162ac53d542`. That exact backend deployment is **SUCCESS**, verified from Railway commit/deployment metadata before frontend delivery.

Frontend target: `SalesCrew/Coke-Spark:master`, Vercel project `prj_YjiNsxSXnWDMBJ7E8UXeyRY2mmWc`, team `team_1jxKZGLAXPKrEyvgqajh8OQc`, domain `coke-spark.vercel.app`. The frontend release commit includes this document and the exact backend Git pointer. Confirmation uses Git and hosting commit/state/domain metadata only.

No production-connected localhost or cloud application routes are used by the agent for verification. No production business-data queries, smoke tests, migrations, activation, backfill or data mutations are included. Rollback is application-only to the preceding commit IDs above.
