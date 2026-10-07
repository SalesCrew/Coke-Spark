# SM Durcharbeit — local per-Einsatz implementation

Updated: 2026-10-07. Built locally, with no commit, push or deployment. The [original plan](sm-SMDurcharbeit-einsatz-override-plan.md) remains the design record.

## Manual preview

- Frontend: http://127.0.0.1:3037/admin/sm/verplanung
- Backend: http://127.0.0.1:4037
- Synthetic admin: `sm-admin@preview.test`, password `preview`.
- Synthetic employee: `sm@preview.test`, password `preview`.
- Authoring: `/admin/sm/durcharbeit`; reporting: `/admin/sm/dashboard` and `/admin/sm/fbmanagement`.

This independent managed worktree is `codex/sm-durcharbeit-einsatz` in the frontend and separate backend repositories. The frontend serves the optimized Next.js build. The preview backend runs the real feature routers against a disposable in-memory PGlite database. Authentication, agreements, user/market directory and Kurti layout use synthetic preview adapters; external storage is unavailable. Restarting the backend resets synthetic records. No production environment files were copied or loaded, no production requests were made, and no scheduled application entry point was started. The human app on 3000/4000 was left unchanged and was never used for verification.

## Implemented behavior

An unstarted Einsatz has the existing searchable admin dropdown for **Fragebogen**. An explicit published Standard or Durcharbeit version replaces the central selection for that one occurrence. **Zentralen Fragebogen verwenden** resets it. The selected type appears immediately; Durcharbeit is blue. Options are prefetched, cached briefly per account/date, and invalidated after central or authoring changes.

Questionnaire, date, market, SM and minutes save atomically for an individual occurrence. Invalid choices and stale edits reject the entire operation. Series-wide SM reassignment is kept a separate operation when combined with individual changes, so there is no partially successful mixed save. Explicit overrides remain on existing occurrence IDs; newly generated occurrences follow the central selection.

Resolution is authoritative on the server: a current frozen submission wins, then an explicit override, then the existing central/legacy behavior. A selected version stays pinned after newer versions are published. Invalid, inactive, deleted, empty or date-ineligible overrides block instead of silently falling back. Once-per-market constraints remain enforced. Pending or restorable occurrences protect referenced questionnaires from deactivation/deletion.

Visit preview revalidates before start. A changed selection requires a refresh and deliberate start; the server also rejects stale revisions. Started visits resume their existing graph, retain queued answers and cannot switch questionnaires. The disabled planning selector shows the frozen name/type rather than today's central selection.

Type/name identity is carried through employee cards/detail, visit start, questionnaire, review, completion, history, correction/deletion requests and admin FB Management. SM reporting has **Alle / Standard / Durcharbeit** scopes and separates completed visits from applicable answered questions. Classification comes from the submission's immutable questionnaire identity. OOS formulas, denominators, time totals, permissions and existing correction/discard workflows remain unchanged. Visits with no OOS questions remain unclassified.

The dashboard export keeps the four existing sheets/cells and adds a separate **Fragebogentypen** sheet. Planning export appends type/name/version columns after existing columns. Authoring exports append catalog identity. Existing dashboard submission-date versus management work-date semantics remain unchanged.

The earlier local blue Durcharbeit catalog/editor draft is preserved, including all standard question types/settings. Its separate route and immutable `smdurcharbeit_` namespace remain intact. GM behavior is unchanged.

## Database and history

Prepared migration: `backend/supabase/migrations/20261007124730_SMDurcharbeit_einsatz_override.sql`. It adds nullable `sm_assignments.smdurcharbeit_questionnaire_override_version_id`, a restrictive foreign key and a partial index. Code/API fields use `SMDurcharbeitQuestionnaireOverrideVersionId`. The migration has no backfill, data updates, deletes or new triggers and was applied only to disposable PGlite databases.

The existing resolved version field is retained. Historical submissions, snapshots, answer revisions, photos/file references, correction/audit events, time entries and cancelled/discarded graphs are not rewritten or relinked. Historical catalog roots remain readable after permitted archival. Synthetic legacy records were compared before/after the migration and new-feature flows: all original stored values, IDs and references remained identical, excluding the new nullable column.

## Verification evidence

**131 selected checks passed:** 86 backend checks, 40 frontend checks and 5 export/privacy checks. Backend and optimized frontend TypeScript builds passed. Both repositories passed `git diff --check`.

The isolated integration tests cover atomic rollback, omitted/null override semantics, invalid versions/dates, roles, stale preview/edit races, idempotent starts, pinned versions, archive guards, once-per-market, series preservation/new defaults, historical graph integrity, reporting scope and no-OOS classification. Existing management/answer logic, time and dashboard checks also pass. Frontend regression checks cover frozen questionnaire identity, picker cache invalidation and delayed responses across account changes without touching pending answers.

Browser verification used only 3037/4037 and synthetic accounts: edit and save a Durcharbeit selection; reopen it; reset to central; employee card/detail/start; answer Ja; review and submit; completion receipt; admin type-filtered metrics and management detail with the saved answer. A central-default change was also checked against a completed standard visit, which retained its original name/type and disabled selector.

Export verification executed the actual workbook-generation function on the same synthetic dashboard API payload. All four original sheets were identical to the baseline, and the appended type/count sheet matched the API. The browser export button produced no console error, but the in-app browser could not capture the blob download event; file-delivery capture remains unverified. This is separate from the verified workbook contents.

## Release limits and tradeoffs

This work is local only. Production must receive the reviewed additive schema change before the compatible backend and frontend. Authorization to push application code alone does not authorize a production migration. No production row rewrite, seed or recalculation is needed.

Pinned versions intentionally require explicit reselection to upgrade an Einsatz. A started visit intentionally locks its questionnaire. After overrides are used, reverting to the old global-first resolver would ignore them: a safe rollback hides the new controls while retaining the override-aware resolver, columns and data.

The remaining release risk is medium: schema/backend/frontend must be released coherently. Historical invariance is verified on synthetic legacy data, not by accessing production. Synthetic storage references were preserved; actual production storage and credentials were never used.

## Restarting this isolated preview

Run from this worktree with an installed Node runtime. Do not source real environment files.

```sh
node backend/node_modules/tsx/dist/cli.mjs backend/tests/SMDurcharbeit-preview.ts
```

In another terminal:

```sh
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:4037 node node_modules/next/dist/bin/next build --webpack
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:4037 node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3037
```

The backend fixture explicitly refuses production database/service-role environment configuration. It does not import the production app, database connection or scheduler. Never run the default backend suite with the human app's environment; use the explicitly isolated fixture suites.
