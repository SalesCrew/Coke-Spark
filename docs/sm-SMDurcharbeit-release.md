# SM Durcharbeit and Fotoarchiv release package

Prepared on 7 October 2026 after the user authorized pushing all completed SM work to production. Preparation used no production queries, migrations or data writes. The user subsequently explicitly authorized **only the two additive schema migrations and necessary schema/migration metadata checks**, followed by backend/frontend deployment. Business-data queries, testing, imports, backfills and recalculations remain prohibited.

Backend release commit: `3d42486bbe86014e92a1740b7f8f64c60b23271e`, pushed to backend `master` after the schema gate was satisfied. The frontend release records this exact backend Git pointer and follows the backend's successful deployment.

## Authorized schema result

Both reviewed migrations completed successfully on the uniquely named Coke Spark Supabase project (`quqefecmqeienxmeueqa`):

| Reviewed source file | Recorded production migration |
| --- | --- |
| `20261007124730_SMDurcharbeit_einsatz_override.sql` | `20261007164039_smdurcharbeit_einsatz_override` |
| `20261007133647_SMDurcharbeit_market_registry.sql` | `20261007164048_smdurcharbeit_market_registry` |

The MCP migration service assigns application timestamps to its ledger; source-file timestamps reflect earlier creation. Consult this mapping rather than treating the differing timestamp as an unapplied migration. Do not rerun these files or repair migration history without a separate reviewed request.

Metadata checks confirmed UUID + nullable override, both `ON DELETE RESTRICT` foreign keys, the partial index, registry RLS, no anon/authenticated write privilege, and service-role SELECT. No business rows were queried or modified. Application-triggered human edits and the backend's existing scheduled behavior remain normal production behavior; no agent smoke checks were run.

SQL SHA-256:
- Override: `e17ac7f118b724c8831817f252a6280e36aceb8f0fefe25d1359fb49f27e19ca`
- Registry: `d2acca3b6a78008733701e8409a4d0988b0ead422b14c1e25d666294182d2546`

## Included application changes

- Separate blue Durcharbeit questionnaire/module editor preserving all standard question settings; standard catalog remains wired to its existing IDs and routes.
- Explicit per-Einsatz questionnaire override, with frozen identity after visit start and consistent employee/admin/report/export visibility.
- Dedicated blue Durcharbeit market and planning pages. Market registry starts empty; import/population awaits the user's list and separate authorization.
- Minimal blue styling for Durcharbeit visits within the ordinary employee Besuche rows.
- SM Fotoarchiv with Standard/Durcharbeit and visit filters, grid/list/detail views, saved-questionnaire links, private photo URLs and bounded ZIP export.
- Verification fixes for typed visit times, account-switch export cancellation and pagination after shrinking results.

## Production targets

Frontend: GitHub `SalesCrew/Coke-Spark`, production branch `master`; Vercel project `coke-spark`, ID `prj_YjiNsxSXnWDMBJ7E8UXeyRY2mmWc`, team `team_1jxKZGLAXPKrEyvgqajh8OQc`, public domain `coke-spark.vercel.app`.

Backend: GitHub `SalesCrew/Spark-Backend`, production branch `master`; Railway project `surprising-delight`, ID `52e48407-7116-44f8-94a7-f0123891881e`, production environment `28d539cb-a359-4f9a-89f5-75fc347f4133`, service `Spark-Backend`, ID `5214a3c7-67fd-4422-8141-3ccd98c80fff`.

The older same-repository Railway service in `zucchini-exploration` is crashed, has no public domain or variables, and has a previously staged deletion. It is not the release target; no staged Railway configuration is accepted or modified.

## Required schema gate

The compatible backend reads the following objects in ordinary SM routes. Releasing it before the schema exists can break existing SM operations.

1. `backend/supabase/migrations/20261007124730_SMDurcharbeit_einsatz_override.sql`: adds nullable `sm_assignments.smdurcharbeit_questionnaire_override_version_id`, a foreign key with `ON DELETE RESTRICT`, and a partial index. Existing assignments retain NULL and keep their existing resolution behavior.
2. `backend/supabase/migrations/20261007133647_SMDurcharbeit_market_registry.sql`: creates empty `sm_smdurcharbeit_markets`, with a restrictive foreign key, RLS, revoked browser/public access and service-role SELECT access.

Both run transactionally, with a five-second lock timeout and sixty-second statement timeout. Neither contains UPDATE, DELETE, INSERT, backfill, seed, historical relinking or a new write trigger. If a lock cannot be acquired promptly, the transaction fails instead of waiting indefinitely. These limits were rerun against disposable synthetic databases.

**Do not execute these on production without specific authorization.** `AGENTS.md` says: “Never use production data or production connections for … migrations …” and “A request to implement, test, deploy, or roll back code does not authorize changing production data.” This document and the reviewed SQL make the required exception concrete; a generic application deployment request does not lift the gate.

## Release order

1. Obtain specific authorization for the two additive schema migrations. If approved, identify the actual Coke Spark database using configuration metadata without disclosing credentials; inspect only the migration/schema metadata necessary to avoid duplicate application. Do not read business rows or run smoke tests.
2. Apply only the reviewed missing schema changes; keep imports, seeds, recalculations and cleanup out of scope.
3. Fast-forward the reviewed backend commit to `SalesCrew/Spark-Backend:master`; wait for the exact commit's Railway deployment to reach SUCCESS using platform metadata only.
4. Fast-forward the reviewed frontend commit to `SalesCrew/Coke-Spark:master`; wait for the exact commit's Vercel production deployment to reach READY and be assigned to the existing production domain.
5. Report the two commit IDs and deployment states. Do not access production-connected app routes for verification.

Rollback, if needed, means redeploying previous application commits. Retain the additive schema so historical links cannot be destroyed; no rollback DROP or data rewrite is authorized.

## Evidence

[Full photo archive verification](sm-photo-archive-verification.md): 94 passing automated checks, actual synthetic employee/admin browser flows, and backend TypeScript/frontend optimized Webpack builds. Additional release review runs cover 19 dedicated-market, questionnaire-history, account assignment and planning-cache checks. The schema lock limits were checked with the override and dedicated-market integration fixtures.

All tests run on disposable PGlite/synthetic storage or static UI fixtures. Human `localhost:3000/4000` is untouched; agent preview `3037/4037` remains independent. Test-only preview routes/storage have no production entrypoint imports. Environment files and node_modules symlinks are excluded from the release commits. Staged paths and credential-like content are checked before committing.

Known verification limits remain unchanged: no live bucket permissions/CORS query, no production data checks, and no observed saved browser ZIP file. API-to-export tests verified ZIP content and original bytes.
