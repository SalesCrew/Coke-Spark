# SM Verplanung — Production Data Model and End-to-End Contract

Status: implemented and applied to production
Last updated: 2026-08-27
Scope: SM planning only; no GM planning or campaign table is reused

## 1. Objective

SM Verplanung must support one-time Einsätze and recurring series without losing the original plan when a date or Shelf Merchandiser changes. A concrete series occurrence must be independently cancellable, movable or reassigned. A deliberate permanent personnel change must update future work without rewriting completed or historical work.

This document is normative for the database, backend and admin UI.

## 2. Non-negotiable invariants

1. Every concrete Einsatz has its own immutable UUID.
2. A series is materialized into concrete `sm_assignments`; the calendar is not calculated only at read time.
3. A series occurrence can be cancelled without deleting or changing the series or sibling occurrences.
4. Original plan values are immutable after insert.
5. Current operational truth is resolved from replacement fields:
   - `effective_work_date = coalesce(replacement_work_date, original_work_date)`
   - `effective_sm_user_id = coalesce(replacement_sm_user_id, original_sm_user_id)`
   - `effective_sm_market_id = coalesce(replacement_sm_market_id, original_sm_market_id)`
   - `effective_planned_minutes = coalesce(replacement_planned_minutes, original_planned_minutes)`
6. Setting a replacement back to the original value clears the replacement column; duplicate truth is not stored.
7. The original Stammnummer is snapshotted on the assignment. Market-master edits never rewrite historical assignment identity.
8. Every planning mutation writes an append-only event in the same database transaction.
9. Completed, in-progress, cancelled and missed assignments are never changed by a series-wide edit.
10. Normal UI actions never physically delete assignments, series, versions, time submissions or events.
11. Ist-Zeit is versioned independently from Soll-Zeit. Corrections create a successor time submission.
12. All business dates use `Europe/Vienna`; timestamps are stored as `timestamptz`.
13. Exactly one logical SM questionnaire is selected centrally for all not-yet-started SM visits. Changing it never rewrites a draft or submitted visit snapshot.

## 3. Source-of-truth matrix

| Business value | Preserved original | Nullable current replacement | Effective value |
| --- | --- | --- | --- |
| Day | `original_work_date` | `replacement_work_date` | replacement, otherwise original |
| SM | `original_sm_user_id` | `replacement_sm_user_id` | replacement, otherwise original |
| Market | `original_sm_market_id` | `replacement_sm_market_id` | replacement, otherwise original |
| Stammnummer | `original_market_internal_id` | `replacement_market_internal_id` | replacement, otherwise original |
| Soll-Zeit | `original_planned_minutes` | `replacement_planned_minutes` | replacement, otherwise original |

Replacement fields describe the current effective plan; they do not attempt to contain the complete edit history. The complete edit history is stored in `sm_assignment_events`.

`status` is a lifecycle value, not an edit flag. `verschoben` and `ersetzt` are derived presentation badges from replacement fields. This prevents an assignment from becoming semantically ambiguous, for example both `cancelled` and `replaced`.

## 4. Domain graph

```text
sm_assignment_series
  └─ sm_assignment_series_versions
       └─ sm_assignments (materialized occurrences)
            ├─ sm_assignment_events (append-only planning audit)
            ├─ sm_assignment_time_submissions (versioned Ist-Zeit)
            └─ sm_questionnaire_submissions (existing runtime table)

users(role = sm) ───────────────┘
sm_markets ─────────────────────┘
sm_questionnaire_versions ──────┘

sm_questionnaire_global_assignments
  └─ sm_questionnaire_templates
       └─ latest effective published sm_questionnaire_version at visit start
```

## 5. Tables

### 5.1 `sm_assignment_series`

Stable identity and lifecycle of a recurring series.

- `id`
- `status`: `active`, `ended`, `cancelled`
- `timezone`, always `Europe/Vienna` in the first release
- `created_by_user_id`
- `is_deleted`, `deleted_at`, `created_at`, `updated_at`

The root does not store mutable recurrence terms. Those live in immutable versions.

### 5.2 `sm_assignment_series_versions`

Immutable series definition.

- `series_id`, `version_number`
- `effective_from_date`: first occurrence governed by this version
- `original_sm_market_id` and `market_internal_id_snapshot`
- `default_sm_user_id`
- `planned_minutes`
- legacy nullable `questionnaire_version_id`; new series do not use it for selection because questionnaire choice is global
- optional `flat_rate_cents` and `currency`
- `frequency`: `weekly` or `biweekly`
- `weekdays`: ISO weekday integers `1..7`
- `valid_from`, `valid_to`
- `change_reason`, `created_by_user_id`, `created_at`

The unique key `(series_id, version_number)` provides deterministic ordering. Versions are append-only. A permanent change creates the next version under a transaction-level advisory lock.

`sm_assignments.series_version_id` is immutable provenance: it always points to the version that originally generated that occurrence. A later permanent personnel change does **not** relink existing assignments to the newer version. The new version defines the changed series state from its effective date onward, while the affected materialized assignments receive `replacement_sm_user_id`. This preserves both the generated history and the current operational truth without conflating them.

### 5.3 `sm_assignments`

One row per concrete one-time Einsatz or materialized series occurrence.

Identity and provenance:

- `id`
- `source_type`: `single` or `series`
- nullable `series_id` and `series_version_id`
- `series_occurrence_key`, equal to the original series date for generated occurrences
- `idempotency_key`, supplied/generated by the backend

Immutable original plan:

- `original_work_date`
- `original_sm_user_id`
- `original_sm_market_id`
- `original_market_internal_id`
- `original_planned_minutes`

Current replacement layer:

- `replacement_work_date`
- `replacement_sm_user_id`
- `replacement_sm_market_id`
- `replacement_market_internal_id`
- `replacement_planned_minutes`

Execution binding and lifecycle:

- nullable `questionnaire_version_id`, written as the exact execution snapshot when a visit starts; it is not an admin planning input
- optional `flat_rate_cents`, `currency`
- `status`: `planned`, `confirmed`, `open`, `in_progress`, `completed`, `cancelled`, `missed`
- `cancelled_at`, `cancelled_by_user_id`, `cancellation_reason`
- `started_at`, `completed_at`
- soft-delete and audit fields

Constraints enforce matching series provenance, positive planned minutes, valid cancellation metadata, consistent replacement market ID/Stammnummer pairs and nonblank idempotency keys.

### 5.4 `sm_questionnaire_global_assignments`

Append-only history of the single central SM questionnaire selection.

- `questionnaire_template_id` points to the stable logical questionnaire, not one mutable occurrence or one frozen content version.
- `assigned_by_user_id`, `assigned_at`
- `superseded_at`, `superseded_by_user_id`
- soft-delete and audit fields

A partial unique index permits exactly one active row. Changing the selection supersedes the previous row and inserts a successor under an advisory lock. The selected template must stay active and must contain a published version. Direct hard deletion is rejected, RLS is enabled and forced, and only the backend service role receives `SELECT`, `INSERT` and `UPDATE`.

At visit start the backend resolves the latest published version of this one template that is effective for the assignment's work date. It stores the exact version on the assignment and snapshots the complete questionnaire graph into the submission. Consequently:

- changing the central selection affects every not-yet-started one-time and series occurrence;
- publishing a new version of the selected logical questionnaire affects subsequent starts without changing the central selection;
- an existing draft or submitted visit always continues with its frozen submission snapshot;
- legacy per-assignment questionnaire IDs are ignored once a central selection exists and are replaced only when that unstarted visit begins;
- no existing assignment or submission is bulk-updated when the central choice changes.

### 5.5 `sm_assignment_events`

Append-only audit timeline.

- `assignment_id`
- optional `series_id`
- `event_type`
- `actor_user_id`
- `reason`
- `before_state` and `after_state` JSON snapshots
- `created_at`

Event types include `created`, `updated`, `rescheduled`, `sm_replaced`, `market_replaced`, `cancelled`, `restored`, `series_future_sm_changed` and `soft_deleted`.

The table rejects `UPDATE`, `DELETE` and `TRUNCATE`. Event snapshots are generated by trusted backend code and contain identifiers and planning values only—never secrets.

### 5.6 `sm_assignment_time_submissions`

Versioned Ist-Zeit source of truth.

- `assignment_id`
- `revision_number`
- `actual_minutes`
- `is_current`
- optional `supersedes_submission_id`
- `submitted_by_user_id`, `submitted_at`
- optional correction reason
- soft-delete and audit fields

There is at most one active current time submission per assignment. A correction marks the old row non-current and inserts a successor in one transaction. Assignment planning values are not overwritten.

## 6. Series materialization

Creating a series performs one short transaction:

1. Validate market, Stammnummer, active SM, dates, weekdays, recurrence and duration.
2. Insert the series root.
3. Insert series version 1.
4. Generate all matching local calendar dates within the explicit validity range.
5. Insert one assignment per date with immutable original snapshots.
6. Insert a `created` event for every assignment.

The first release limits a series to two years and 1,000 generated occurrences. The unique active index `(series_id, series_occurrence_key)` plus an idempotency key makes retries safe.

## 7. Editing one occurrence

Occurrence editing is always the default.

- Move date: set or clear `replacement_work_date`.
- Replace SM: set or clear `replacement_sm_user_id`.
- Change market: set or clear the replacement market and its Stammnummer snapshot together.
- Change Soll-Zeit: set or clear `replacement_planned_minutes`.
- Cancel: set `status = cancelled` and cancellation metadata.
- Restore: clear cancellation metadata and return to the pre-execution planning state.

Sibling assignments and the series definition are untouched. The update uses a row lock and writes an event atomically.

Assignments that are already `in_progress` or `completed` cannot be replanned. A cancelled assignment must be restored before it can be edited.

## 8. Permanent series personnel change

Changing one series occurrence to another SM presents two explicit choices:

1. `Nur dieser Einsatz` — writes `replacement_sm_user_id` only on the selected assignment.
2. `Ab diesem Einsatz dauerhaft` — requires a confirmation UI showing the old SM, new SM, effective date and number of affected future assignments.

The permanent operation:

1. Takes a transaction-level advisory lock for the series.
2. Creates the next immutable series version with the new default SM and selected effective date.
3. Selects future assignments in the series whose effective date is on/after that date and whose status is `planned`, `confirmed` or `open`.
4. Sets their replacement SM to the new user, clearing it where the new user equals the original.
5. Keeps every affected assignment linked to the immutable series version that originally generated it.
6. Does not modify completed, in-progress, cancelled, missed or soft-deleted rows.
7. Writes a `series_future_sm_changed` event for every affected assignment.
8. Returns the exact affected/skipped counts to the UI.

This makes the new SM the current truth for future work while every occurrence still preserves its originally generated SM.

## 9. Cancellation semantics

`Einsatz absagen` is not deletion.

- A one-time Einsatz becomes `cancelled`.
- One occurrence of a series becomes `cancelled`; the series and other assignments remain active.
- Cancelling a series is a separate future operation and must present an impact preview.
- A cancelled occurrence remains queryable and exportable.
- Technical soft deletion is reserved for administrative data correction and is not the default UI action.

## 10. API contract

Admin endpoints are backend-authorized for `admin` and `sm_admin`:

- `GET /admin/sm-planning/questionnaire-assignment`
- `PUT /admin/sm-planning/questionnaire-assignment`
- `GET /admin/sm-planning/assignments?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /admin/sm-planning/assignments/:id/reassign-preview?smUserId=UUID`
- `POST /admin/sm-planning/assignments`
- `POST /admin/sm-planning/series`
- `PATCH /admin/sm-planning/assignments/:id`
- `POST /admin/sm-planning/assignments/:id/reschedule`
- `POST /admin/sm-planning/assignments/:id/reassign`
- `POST /admin/sm-planning/assignments/:id/cancel`
- `POST /admin/sm-planning/assignments/:id/restore`
- `POST /admin/sm-planning/assignments/:id/time`

Every response returns original, replacement and effective values. The client never has to guess which value is authoritative.

Mutations require an `expectedUpdatedAt` concurrency token for existing assignments. A stale editor receives HTTP 409 and reloads instead of overwriting another admin’s change.

The series reassignment preview validates the target SM and returns the effective date plus exact affected/skipped occurrence counts before the permanent action is confirmed. Ist-Zeit submissions are independently versioned; changing an existing value requires a correction reason.

## 11. UI contract

- The week table is loaded from the API; no fixture rows or hardcoded SM/market options remain.
- One central, searchable questionnaire control sits above the week table. It applies to all not-yet-started visits and is never repeated inside an individual Einsatz drawer.
- Creating a one-time Einsatz or series is blocked until a valid central questionnaire has been selected.
- Market selection uses the real SM market UUID but prominently shows the Stammnummer.
- Rows display the effective date and SM.
- When replaced, rows also display `Original: …` so the history is understandable without treating it as current truth.
- `Verschoben` uses the purple badge; `Ersatz` uses blue. Lifecycle status remains separately available in accessible text/title.
- Editing a series occurrence defaults to `Nur dieser Einsatz`.
- Changing the SM on a series occurrence reveals the two-scope choice and impact explanation.
- Cancellation says `Einsatz absagen`, never `Serie löschen` or `Einsatz löschen`.
- Loading, empty, error and stale-edit states use existing Coke Spark admin patterns.

## 12. Index and query contract

- Partial indexes cover active/non-deleted assignments by effective date, effective SM and series occurrence.
- Every foreign key has a supporting index.
- Equality columns precede date ranges in composite indexes.
- Weekly list queries always filter a bounded date range.
- Series-wide changes use one set-based update and a set-based event insert; no N+1 mutation loop.

## 13. Security and retention

- All tables have RLS enabled and forced.
- `public`, `anon` and `authenticated` receive no table privileges.
- Only backend `service_role` access is granted.
- The service role has no `DELETE` or `TRUNCATE` privilege on mutable planning tables.
- Soft-delete triggers synchronize `is_deleted`, `deleted_at` and `updated_at`.
- Assignment events are append-only.
- The frontend never receives a Supabase service key.

## 14. Migration and verification gates

Before production apply:

1. Backend and frontend builds pass.
2. Focused tests cover one-time creation, series generation, one-occurrence cancellation, occurrence-only SM replacement, permanent future replacement, rescheduling, stale-write rejection and immutable completed rows.
3. Migration is additive and does not alter GM tables or existing SM data.
4. Security and performance advisors are reviewed.

After production apply:

1. Verify all tables, constraints, indexes, triggers, RLS and privileges.
2. Verify the FK from `sm_questionnaire_submissions.assignment_id` to `sm_assignments.id`.
3. Do not create smoke-test rows in production.
4. Verify migration history and application health only through metadata/read-only checks.

### Production application record — 2026-08-24

- `20260824081232 sm_planning_domain` created the five planning tables, enum types, validated questionnaire FK, constraints, indexes, triggers, forced RLS and least-privilege grants.
- `20260824081346 sm_planning_composite_fk_index` replaced the redundant single-column series-version index with the exact `(series_version_id, series_id)` supporting index requested by the database advisor.
- `20260824082108 sm_planning_least_privilege` removed Supabase default `REFERENCES` and `TRIGGER` table grants that the backend runtime does not use.
- The exact first migration completed successfully in a `BEGIN … ROLLBACK` dry run before it was applied.
- Post-apply metadata verification proved that every table and constraint exists, all constraints are validated, all protection triggers are enabled, RLS is enabled and forced, and `anon`/`authenticated` have no grants. `service_role` has only the intended per-table `SELECT`/`INSERT`/`UPDATE` matrix and no `DELETE`, `TRUNCATE`, `REFERENCES` or `TRIGGER` privilege.
- A rollback-only behavioral smoke test exercised replacement/effective values, single-occurrence cancellation, immutable series provenance, a permanent-future series version, two Ist-Zeit revisions, immutable-original protection, append-only event protection and hard-delete rejection.
- The rollback verification showed zero rows in every planning table and no temporary smoke market. No production fixture or smoke user was retained.
- The production performance advisor reports no missing index for the composite series-version FK. New-table unused-index notices are expected until real planning traffic exists.
- `rls_enabled_no_policy` INFO notices are intentional: the new tables are backend-only, forced-RLS tables accessed by the Supabase `service_role`; direct `anon` and `authenticated` access is denied.

### Production application record — 2026-08-27

- Migration `20260827135019 sm_global_questionnaire_assignment` created only `sm_questionnaire_global_assignments` plus its indexes, validation/immutability/soft-delete/hard-delete triggers and the protection trigger on the already selected template.
- No questionnaire was auto-selected, no assignment was backfilled and no existing row was updated. Production counts stayed at seven active SM assignments and one active questionnaire submission; the new selection table remained empty for the explicit admin choice in the UI.
- Postflight proved validated constraints, one-current-row uniqueness, enabled and forced RLS, zero `anon`/`authenticated` grants and exactly `SELECT`/`INSERT`/`UPDATE` for `service_role`.
- A rollback-only behavioral verification proved current-row uniqueness, safe supersession, hard-delete rejection and zero retained test rows.
- Backend and frontend production builds passed; 21 focused planning/runtime tests passed.
- Supabase reports only the expected backend-only `rls_enabled_no_policy` INFO and unused-index INFO entries for the brand-new empty table.

Application verification on the same date:

- Frontend production build passed.
- Backend TypeScript build passed.
- All 7 focused SM planning tests passed.
- A real local HTTP login using the ignored SM-admin test account returned role `sm_admin`; the bounded assignment list returned HTTP 200, the oversized-range guard returned `sm_planning_range_too_large`, and an invalid no-write create returned `sm_market_invalid` before any insert.
