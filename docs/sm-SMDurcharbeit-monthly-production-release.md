# SM monthly Durcharbeit — production release package

Prepared 2026-10-09. The user explicitly authorized **these two new migrations, necessary schema/migration metadata checks and backend/frontend deployment**: “Authorize these two migrations and deploy.” Both exact artifacts below have now been applied successfully. The earlier October 7 override/registry migrations are different artifacts and were not rerun.

## Scope

- Monthly campaigns, existing dedicated market registry selection, calendar-month obligations, per-SM ownership, frozen questionnaires and audited transitions.
- First visits and same-month follow-ups through the normal SM question engine, with answer/photo provenance and independent next-month state.
- Management, actual time/corrections, activity, profile, photo archive, XLSX reporting and existing privacy inventory recognize monthly executions.
- Employee dashboard has a normal inline, responsive Durcharbeit card. It fills available space, opens the full page and remains stationary when Home expands. On short phones the overview/calendar region scrolls. Messages use the SM menu; GM behavior is unchanged.
- The former dated Durcharbeit planning UI remains available at `/admin/sm/durcharbeit-verplanung/alt`. Existing assignments and their saved graph are not converted or removed.

## Required database artifacts

Applied in this order after specific authorization, to the existing Coke Spark project `quqefecmqeienxmeueqa`:

| File | SHA-256 | Purpose |
| --- | --- | --- |
| `backend/supabase/migrations/20261009100850_SMDurcharbeit_monthly_campaigns.sql` | `624bbb1f258b5eeb36548a05b57f832785b82dd9979edbb096bc29b8980bee04` | Creates eleven empty monthly-domain tables, two nullable submission links, restrictive foreign keys/indexes and server-only grants/RLS. |
| `backend/supabase/migrations/20261009133000_SMDurcharbeit_context_integrity.sql` | `0f410bedc6646a2181123e6dab89fc526d498973e07764d0e41de565a6bc368a` | Adds context/identity checks for new monthly records, author/market/month provenance, protected original-photo links and actual-time consistency. |

Both files are transactional, with a five-second lock timeout and sixty-second statement timeout. There is no historical INSERT, UPDATE, DELETE, import, reset, backfill, conversion, cleanup or cascade deletion. Existing submissions keep NULL monthly links. The additional guards target the new domain; existing dated identity, questionnaire snapshots, answers, files, timestamps and constraints are preserved.

Additive DDL still locks schema objects and builds indexes on the existing submission table. A busy workload or insufficient schema privileges can make a migration fail. Do not raise the timeouts, rerun a partially applied file, repair the ledger or weaken constraints automatically. Confirm the transaction outcome using only migration/schema metadata and report any conflict.

## Authorization boundary

[AGENTS.md](../AGENTS.md) explicitly says: “Never use production data or production connections for … migrations …” and “A request to implement, test, deploy, or roll back code does not authorize changing production data.” The user supplied the concrete exception for **only these two new migrations and necessary schema/migration metadata checks**, followed by deployment. This does not authorize importing markets, publishing a real campaign, generating production targets, starting visits, changing saved answers or running smoke checks.

Preparation and all tests/builds used synthetic settings and disposable data. Production access during this release was restricted to the authorized DDL and schema/migration metadata; no business rows were queried or mutated. The human 3000/4000 app was not used for agent verification.

## Verification

- Native disposable PostgreSQL 16: **87 passed, zero failed/skipped** covering migrations/history sentinels, monthly lifecycle, concurrency, transitions, answer/photo inheritance and withdrawal, report reconciliation, old Einsatz/market import, inbox, archive and overlap guards.
- Existing isolated SM management/correction suite: **21 passed**. Two diagnostic assertions now report synthetic response bodies on status mismatches. An initial run encountered a stopped temporary PostgreSQL cluster; it was replaced by a new marked disposable cluster. The first combined management run also had transient HTTP status mismatches; the independent rerun passed without changing application behavior.
- Frontend export/session/ownership/time suites: **34 passed**. Existing GM chart/filter/loading and SM dashboard suites: **51 passed**.
- Backend production TypeScript build passed. The optimized Next.js Webpack build passed with all 64 routes, in a clean temporary copy with synthetic public settings and no production environment files. Scoped lint passed for 13 new/refined SM components and the targets hook; both repositories passed whitespace checks. The first temporary copy omitted the existing development-route fixture directory; copying the tracked fixtures completed the build without modifying application source.
- Previously completed isolated employee/admin browser flows and maximum-roster testing are documented in [the living implementation plan](sm-SMDurcharbeit-monthly-campaign-living.md) and [the UI review](sm-SMDurcharbeit-ui-review.md). Latest card geometry: 198px high on 390×844, 160px on 320×568, with 28px clearance from closed Home. Expanded Home does not reposition the card, and its link opens the full list.

## Delivery order and targets

1. Finish code/build review and create exact local commits, excluding environment files, dependency symlinks, preview images/artifacts and Supabase temporary state.
2. Obtain the narrow migration exception above. Inspect only migration/schema metadata to identify missing artifacts and detect conflicts; no business-data queries.
3. Apply only the two reviewed missing migrations. Preserve all older migration ledger entries.
4. Push the reviewed backend commit to `SalesCrew/Spark-Backend:master`. Wait for the exact commit's Railway SUCCESS status: project `52e48407-7116-44f8-94a7-f0123891881e`, environment `28d539cb-a359-4f9a-89f5-75fc347f4133`, service `5214a3c7-67fd-4422-8141-3ccd98c80fff`.
5. Record the exact backend Git pointer and push the reviewed frontend commit to `SalesCrew/Coke-Spark:master`. Wait for Vercel READY and the existing production alias: project `prj_YjiNsxSXnWDMBJ7E8UXeyRY2mmWc`, team `team_1jxKZGLAXPKrEyvgqajh8OQc`, domain `coke-spark.vercel.app`.
6. Confirm delivery from platform/commit metadata only. Do not send authenticated smoke requests, production mutations or database verification queries.
7. The human admin reviews and publishes any real campaign through normal application controls. Code delivery does not automatically activate campaigns or convert old visits.

If rollback is required, restore the prior frontend/backend application commits and retain additive schema/history. No DROP or business-data rollback is authorized.

## Current state

The two authorized migrations were applied successfully, with these production ledger identities:

| Source artifact | Production ledger version | Migration name |
| --- | --- | --- |
| `20261009100850_SMDurcharbeit_monthly_campaigns.sql` | `20261009154540` | `smdurcharbeit_monthly_campaigns` |
| `20261009133000_SMDurcharbeit_context_integrity.sql` | `20261009154547` | `smdurcharbeit_context_integrity` |

Catalog-only checks confirmed eleven new tables with enabled/forced RLS and no anon/authenticated access; both nullable UUID submission links; four valid submission constraints, 88 valid new-domain constraints with restrictive foreign keys, 49 ready/valid indexes, two invoker trigger functions without browser execution grants and nine enabled new-domain triggers. Existing Supabase `postgres` default privileges give `service_role` full table privileges, including DELETE; these defaults were not altered by the two reviewed migrations. Application writes remain mediated by the existing role/ownership-checked server, and this release performed no deletes or business-data operations. No third migration or privilege repair was applied.

Backend release commit: `03b5260ee3607c82a96203b886b7c85097b6eebc`, pushed to `SalesCrew/Spark-Backend:master`. Railway deployment `3d3ab07f-3b0b-4871-83ed-9cc277acdec9` is **SUCCESS** for that exact commit in the production service above. The frontend release commit contains this document and that exact backend Git pointer. Optimized frontend/backend builds, 13-file scoped lint, staged-path/credential-pattern checks and whitespace checks passed. Environment files, dependency symlinks, screenshots, build output and Supabase temporary state are excluded. Frontend delivery follows backend SUCCESS and is confirmed from Vercel metadata for the exact commit and production alias; no authenticated app smoke check is permitted.
