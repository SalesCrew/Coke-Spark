# SM Durcharbeit automatic planning

Implemented locally on 2026-10-13. No production connection, query, migration, backfill or deployment was used for this change.

## Authoritative owner

The existing registry column `sm_smdurcharbeit_markets.smdurcharbeit_sm_user_id` is authoritative. The release receipt in [the account-link release](sm-SMDurcharbeit-market-sm-link-release.md) records 424/424 linked imported markets on 2026-10-09. This is historical release evidence, not a fresh inventory of production.

Campaign creation selects all registry markets, a complete chain/search result, or individual stable market IDs. SM names are read-only. The server resolves owners from registry IDs when creating/saving drafts and again during publication. Legacy client owner fields are accepted for compatibility but ignored. Campaign ownership never falls back to names or normal-market assignments. On creation, the importer writes its uniquely matched active SM to both account columns, and manual market creation writes its validated selected SM to both columns, in the same transaction. Reimports preserve all previously saved registry SM IDs; this change performs no existing-row backfill. Missing, inactive or deleted SM accounts block publication; no obligation is silently assigned to somebody else.

Publication checks the exact selection and preview token, locks selected registry rows through commit, and creates the existing monthly obligation graph. An SPAR-only selection remains SPAR-only after publication. No dated assignment, scheduled job or invented Soll is created.

## Existing campaigns and historical preservation

Current/future obligations in a published or paused campaign follow the registry ID if no physical visit has ever started for that target. This resolution happens on reads and makes already-published, unstarted work visible to the saved SM without rewriting campaign, target or owner rows. Excluded obligations remain excluded. Only current, active, required targets may start; pause, dates, account status and market status still gate work.

A past month, archived/ended campaign, or target with any physical visit keeps its recorded owner. Draft, completed, discarded and invalidated visits remain pinned. This deliberately avoids transferring historical work or an in-progress draft when the market registry changes.

On a successful new visit start, campaign/target locks and a registry SHARE lock serialize owner resolution. If the original target owner differs from the registry owner, a new owner revision is appended and linked to this new visit atomically. Earlier revisions remain unchanged. Existing visit, answer, photo, submission and time records are never rewritten by automatic planning. A registry change after start cannot steal that visit. Future untouched months still use the current registry ID.

Campaign extension uses saved registry IDs for newly added months. A required market with no active saved SM blocks extension atomically. Older months and physical history are unchanged.

## Campaign market controls

`SMs zuordnen` and the row-level owner dropdown were removed. The target action is now `Marktstatus`, for inclusion/exclusion only; API attempts to override an SM are rejected. `Märkte bearbeiten` supports individual and filtered selections, one month or future months, a read-only preview, protected visits and atomic application. See [market editing](sm-SMDurcharbeit-campaign-market-edit.md).

No new database columns or migration are required. Deployment needs frontend and backend together. This local change does not repair an incorrectly imported name/ID or transfer an existing physical visit.

## Verification

All checks used clean process environments and disposable synthetic databases. Neither production environment files nor the human localhost 3000/4000 were used.

- 41 distinct native PostgreSQL checks passed across automatic ownership, campaign market editing, transitions, report/photo preservation, writer concurrency and maximum scale. The final automatic/concurrency run passed all 18 checks after adding registry locks and extension coverage.
- A 5,000-market campaign published and extended to 24 months / 120,000 targets, retaining old target IDs, exclusions and empty new answer graphs.
- Six races between registry ID changes and visit start, twelve competing start requests, duplicate publication, time overlap and historical constraints passed.
- Two additional disposable import checks passed after wiring new registry IDs: all 424 source rows and duplicates retained, repeated imports stable, saved existing IDs preserved, ambiguous names unassigned, manual creation validated, and historical answer/photo/time graphs unchanged. The final combined import/automatic run passed all ten checks.
- Seven frontend checks passed for complete filtered selection, queue eligibility, historical links and spreadsheet reporting.
- Frontend/backend TypeScript, scoped Next ESLint, whitespace checks and the optimized frontend build passed.
- Browser: all-market and individual/filtered selection with read-only SM names; SPAR-only publication retained exactly two markets. The second SM saw only its registry-owned market, started it, saved the answer/photo and submitted a 15-minute visit. Admin campaign counts and FB Management then showed the same SM, Ja answer, original photo and 08:00–08:15 time. Desktop and narrow viewport layouts were reviewed. Local screenshots are in the untracked preview artifacts.
- API flow: selection → registry-owned publication → employee access → visit start → answers → photo → submit → monthly report, FB Management and photo archive. Snapshots assert previous owners/visits/answers/photos/times stay unchanged and GET reads do not update rows.

The wider pre-existing monthly suite still has the previously reproduced weekly-profile assertion at line 281: its fixed October 7/9 records lie outside the actual current week. Product profile/time logic was not changed. An unrelated PGlite RESTRICT SQLSTATE assertion was previously reproduced on released backend HEAD; it is outside this change.

Local review: http://127.0.0.1:3037/admin/sm/durcharbeit-verplanung with synthetic backend http://127.0.0.1:4037. Synthetic admin: `sm-admin@preview.test` / `preview`; employees: `sm@preview.test`, `sm-second@preview.test` / `preview`.

## Production release preparation — 2026-10-14

The user authorized releasing this exact completed scope with “push that”. No schema or data operation is part of this release. Existing production master changes are retained, with backend deployment first, followed by the frontend and exact backend Git pointer. Deployment status is checked using platform metadata only; no application smoke tests, production business-data reads/writes, campaign edits or automatic repairs are performed.

Targets: backend `SalesCrew/Spark-Backend:master`, Railway project `52e48407-7116-44f8-94a7-f0123891881e`, production environment `28d539cb-a359-4f9a-89f5-75fc347f4133`, service `5214a3c7-67fd-4422-8141-3ccd98c80fff`; frontend `SalesCrew/Coke-Spark:master`, Vercel project `prj_YjiNsxSXnWDMBJ7E8UXeyRY2mmWc`, team `team_1jxKZGLAXPKrEyvgqajh8OQc`, existing domain `coke-spark.vercel.app`.

Backend release candidate: `78aa858695f38ce955e86049312bb5d210cdbeca`. The merge preserves the existing Billa Plus visibility release. All 32 targeted import/automatic-owner/market-edit/report/photo/transition checks passed again after merging production master, with clean environments and disposable synthetic databases; backend compilation and staged credential/whitespace checks passed.
