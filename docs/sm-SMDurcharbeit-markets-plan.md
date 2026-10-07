# SM Durcharbeit — separate markets, planning and employee presentation

Date: 2026-10-07. Scope confirmed: SM only. Build locally; no push or production access.

## Design

1. Add **Durcharbeit Märkte** at `/admin/sm/durcharbeit-maerkte`. Reuse the normal market table, search, filters, virtualization, loading states and detail drawer. A blue heading/rail and blue selection/focus treatment distinguish it. This phase is a read-only market directory: no import, creation, synchronization, editing or deletion. The user's list/import specification comes later.
2. Add **Durcharbeit Verplanung** at `/admin/sm/durcharbeit-verplanung`, reusing the existing planning controls and blue styling. Select a published Durcharbeit questionnaire when planning an individual Einsatz. It is pinned on the existing assignment and uses the existing visit engine. Keep recurring-series creation in the standard workspace for this phase; do not create recurring Durcharbeit defaults before their rules are specified. Existing Durcharbeit occurrences, including historical/ordinary-market ones, remain accessible.
3. Keep the existing blue Durcharbeit questionnaire editor at `/admin/sm/durcharbeit`. Link it from the new planning page; do not create a duplicate catalog or move questionnaire IDs.
4. On the SM employee dashboard, keep Standard and Durcharbeit assignments in one **Besuche** list, per the user's presentation correction. Use the existing compact row height and shared ordering/count/scroll area. Durcharbeit rows have a subtle blue tint, blue actions and a small plain-text type label beside the address. No separate section/card or questionnaire-type pills. Questionnaire name/version stays available in details. Date/calendar, status, resume, ownership, visit URLs and history stay intact.

## Data boundary

Use a separate additive `sm_smdurcharbeit_markets` registry referencing existing `sm_markets.id`. This identifies dedicated markets without editing existing market records, duplicating assignments, converting historical questionnaire types or inferring membership from names/chains. The table starts empty; this task never populates production. Only disposable demo markets enter the local registry. Apply RLS and deny browser roles; existing authenticated admin backend permissions govern reads. There is no registry-write or import endpoint in this phase.

New individual assignments for a dedicated market require an explicit eligible Durcharbeit questionnaire. Validate the final work date after holiday adjustment, reject resets to a standard default, and retain atomic rollback. Started submissions still win over all current configuration. Existing assignments on ordinary markets with Durcharbeit questionnaires are recognized by their frozen/effective questionnaire type and remain visible. No historical backfill, orphaned IDs, answer rewrite or storage changes.

## Work order and verification

Prepare the additive registry migration, implement scoped directory reads and creation validation, parameterize existing market/planning UI, add navigation, then theme individual employee rows/details/actions in the shared list. Verify only with PGlite and synthetic accounts on 3037/4037: market separation, empty/error/loading states, filters/details, planning and question selection, visit start/answer/submit, mixed dashboard rows, permissions, invalid-choice rollback and unchanged historical rows. Run relevant regression checks and optimized builds. Leave the preview running and save screenshots for manual review.

## Release and limits

No commit, push, deployment or production migration. Future release requires the reviewed additive schema before compatible backend/frontend. Import matching, file mappings, data population and recurring Durcharbeit rules await the supplied list/specification. Historical records and questionnaire identities must stay unchanged. This local phase has medium integration risk because separate directory membership and questionnaire identity must be respected together; tests must cover both independently.

## Local implementation and review evidence

Implemented in the managed `sm-durcharbeit-einsatz` frontend/backend worktrees. The new registry migration is `backend/supabase/migrations/20261007133647_SMDurcharbeit_market_registry.sql`; it creates an empty registry with a restrictive foreign key, RLS and no browser write grants. It contains no data migration/backfill. It and the earlier Einsatz override migration have been applied only to disposable PGlite fixtures.

The directory uses an explicit market scope, preserves existing IDs and hides dedicated markets from ordinary directory/synchronization/import matching. Dedicated entries are read-only in this phase. Planning uses an explicit version on creation, validates it before inserting and again after holiday adjustment, and rejects dedicated recurring defaults. Existing ordinary-market Durcharbeit assignments remain visible; saved submission identity takes priority over current market membership and current catalog settings.

Verification completed on 2026-10-07:

- 96 selected backend checks passed across the authoring, override, dedicated-market, management and shared visit/planning suites. These cover permissions, FK/RLS, invalid-choice rollback, holidays, recurring bypass rejection, answer submission/reporting and unchanged historical answers, timing and audit. The management fixture was updated to apply the additive registry migration; its previously missing-table failure was resolved and its complete 21-check suite passed.
- 54 selected frontend checks passed, including rendered blue rows, explicit empty/error/loading states, read-only details, routing, actual create-payload serialization, required questionnaire selection and frozen historical question identity. Five export/privacy checks also passed.
- Backend TypeScript build and optimized frontend Webpack build passed. Turbopack cannot resolve this worktree's external dependency symlink; Webpack is the verified local build path. No dependency or environment changes were required.
- Browser verification used synthetic accounts only on 3037/4037. A 75-minute Einsatz was created in the dedicated market with a published Durcharbeit version, appeared in the blue SM section, opened the pinned question, saved a synthetic “Ja” answer and completed with explicit start/end dates and times. Its row returned as Erledigt. The admin dashboard then showed two completed visits, one Standard and one Durcharbeit. Existing standard rows remained visible.

Frontend: `http://127.0.0.1:3037`. Backend: `http://127.0.0.1:4037`. The backend is an in-memory disposable fixture with no production environment, storage or scheduled jobs. It resets when restarted. Demo logins: `sm-admin@preview.test` or `sm@preview.test`, password `preview`.

Review routes: `/admin/sm/durcharbeit-maerkte`, `/admin/sm/durcharbeit-verplanung`, `/admin/sm/durcharbeit`, and `/sm` for employee presentation. Screenshots are saved locally at `/tmp/SMDurcharbeit-markets-preview.png`, `/tmp/SMDurcharbeit-planning-preview.png` and `/tmp/SMDurcharbeit-dashboard-preview.png`.

The human production-connected 3000/4000 app was not used for agent work. Production data, history and environment files were not accessed or changed. Nothing was committed or pushed.

## Presentation correction — 2026-10-07

The user requested a shared minimalist visit list instead of the initial separate blue section. Only `AssignmentList` and its `SmDashboardSchedule` presentation were adjusted. All selected assignments now render together in their existing status order, with one total count and one scroll area. Ordinary rows retain their styling; Durcharbeit rows use the same 44px height (58px when the existing holiday note is present) with restrained blue color and a plain type label. Planning, questionnaire selection, APIs, database code and historical data were not changed. Sixteen relevant synthetic UI/cache/visibility checks passed; the mixed-list check verifies both types render in the input order with normal and blue actions. The optimized frontend build passed. Browser verification on the synthetic SM account confirmed one Besuche list with five assignments, both types and the shared calendar. The updated screenshot is `/tmp/SMDurcharbeit-mixed-visits-preview.png`. Preview 3037/4037 remains running; nothing pushed.
