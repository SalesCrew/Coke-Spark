# SM Aktivitäten & Anfragen — Living Design and Verification Record

Last updated: 2026-08-26 (Europe/Vienna)

## Scope and non-negotiable boundaries

This document is the source of truth for the personal Shelf Merchandiser activity archive and the SM-admin request review workflow.

- Only `sm_*` runtime and request tables are used. GM visit, answer, request, reporting, IPP, and bonus records are never reused or mutated.
- An SM can only read submitted questionnaire data owned by their own user ID.
- Submitted answers remain read-only. Corrections and questionnaire removals always require an auditable request and a full admin decision.
- `admin` and `sm_admin` have the same review capability. The active admin workspace only changes which request inbox is displayed.
- Questionnaire removal never removes the planned Einsatz or its current actual-time revision. It removes only the selected SM questionnaire submission graph from active use.
- Every mutable SM row is soft-deleted. The database rejects hard `DELETE` and `TRUNCATE`; answer events are append-only.

## GM behavior inspected and intentionally carried over

The GM implementation was inspected in the completed-visit API, activity page, admin request flap, answer approval transaction, and visit deletion transaction.

Useful behavior retained:

1. Completed visits are listed newest first and opened as a read-only historical snapshot.
2. A request stores the exact question wording, current answer snapshot, requested payload, human summary, reason, status, reviewer, timestamps, and admin note.
3. Only one open answer request exists per concrete question and one open deletion request per visit.
4. Re-sending the same open request updates/replays that request instead of creating duplicates.
5. Pending requests are shown before reviewed history, both to the submitter and the admin.
6. Admin approval and rejection are serialized in a transaction. A reviewed request cannot be applied a second time.
7. Answer approval validates the requested payload against the immutable question snapshot before writing.
8. Deletion approval soft-deletes the selected questionnaire graph and closes its other pending answer requests.
9. The admin inbox combines answer, questionnaire-delete, and time-correction requests so no SM request is hidden in another page.

Differences required for SM:

- SM assignments, markets, questionnaire snapshots, versioned answers, files, and request tables remain isolated from GM.
- Corrected SM answers create a new `sm_question_answers` version; the prior answer is retained as history instead of being overwritten.
- SM conditional logic is re-evaluated against the requested answer. Approval is blocked when the correction would reveal a required question without a valid answer.
- Photo corrections can retain or remove already submitted protected photos. New photo uploads are not silently attached through a correction request.
- Questionnaire deletion deliberately leaves `sm_assignments` and `sm_assignment_time_submissions` unchanged.

## Data lifecycle and invariants

### Personal activity archive

- Source: current, non-deleted `sm_questionnaire_submissions` in `submitted` state, owned by the authenticated SM.
- A compact list contains assignment ID, submission ID, market snapshot, questionnaire snapshot, submitted/start/end times, planned and actual minutes, answer totals, and photo count.
- Opening one row loads the existing immutable submission snapshot and signed protected-photo URLs through the owner-scoped SM visit endpoint.
- No activity endpoint accepts a user ID from the client.

### Answer correction request

1. SM submits a client token, exact submission/question IDs, complete typed answer payload, and mandatory reason. The backend derives the display summary from the normalized payload and immutable option snapshots; client summary text is never trusted.
2. Backend locks the concrete submission/question, verifies ownership, current/submitted state, applicability, and current answer version.
3. Backend normalizes the requested answer using the immutable type/config/options snapshot and rejects unchanged or incomplete answers.
4. The request stores the original answer ID and full normalized original snapshot. Network retries replay by client token; one pending question request remains the database invariant.
5. Admin list computes whether the request is still current and conditionally applicable.
6. Approval locks request, submission, question, and current answer; rejects stale requests; inserts one next answer version and normalized option/matrix/file children; appends an answer event; recalculates conditional applicability and counters; records reviewer/applied answer/timestamps.
7. Rejection only records the decision and audit note. It never changes questionnaire data.

### Questionnaire deletion request

1. SM submits a client token and mandatory reason for one owned submitted questionnaire.
2. Backend stores immutable questionnaire, version, market, and submission-time snapshots.
3. Approval locks the request and submission, soft-deletes answer children, answer versions, question/section snapshots, and the submission, then cancels any still-open answer requests for that submission without deleting their audit rows.
4. The delete request itself remains visible as approved history.
5. Assignment state, planning history, actual time, flat rate, and every other questionnaire submission remain untouched.

### Unified SM-admin inbox

- Categories: answer correction, questionnaire deletion, and assignment actual-time correction/deletion.
- Pending items appear first and are grouped by SM; reviewed history stays inspectable.
- Each decision supports an optional admin note, visible to the SM in request history.
- Approval buttons are disabled for stale/non-applicable answer requests. Backend validation remains authoritative.

## Failure, retry, and concurrency rules

- Client request tokens make user retries idempotent. Reusing a token for another target, answer payload, or reason returns a conflict instead of silently replaying different work.
- Advisory/row locks serialize request creation and review. Creation and review use the same resource advisory key and the same submission → question → request row-lock order to avoid deadlocks.
- A unique partial index prevents two pending requests for one question/submission.
- Approval compares the exact original answer ID/version to the current answer; stale requests return a conflict and do not partially write.
- All approval mutations happen in one database transaction.
- Failed protected-photo signing affects preview only, never request ownership or answer integrity.
- List/read failures show retryable UI states; no hardcoded activities or local-only requests are used.

## Production database posture and applied audit migration

Read-only production audit on 2026-08-26:

- `sm_answer_change_requests`: exists, zero rows, RLS enabled and forced, soft-delete/hard-delete triggers present.
- `sm_questionnaire_submission_delete_requests`: exists, zero rows, RLS enabled and forced, soft-delete/hard-delete triggers present.
- `sm_assignment_time_change_requests`: exists, RLS enabled and forced, soft-delete/hard-delete triggers present.

The empty request tables allowed two small additive migrations without rewriting questionnaire data:

- `sm_activity_request_audit` applied on 2026-08-26: non-empty SM-scoped client tokens, exact `applied_answer_id`, `applied_at`, strict review-state constraints, active-token uniqueness, and the composite applied-answer/submission foreign key.
- `sm_activity_applied_answer_fk_index` applied immediately afterward: replaced the first-column audit index with a covering `(applied_answer_id, submission_id)` index after the Supabase performance advisor identified the composite FK coverage gap.

Post-apply counts remained stable at one questionnaire submission and six question answers; the migrations themselves inserted no request rows. RLS remains enabled and forced, `anon`/`authenticated` retain no table grants, and `service_role` retains select/insert/update without delete or truncate.

## Implementation checklist

- [x] Add request idempotency/applied-result audit columns and matching Drizzle schema.
- [x] Add owner-scoped completed activity list and SM request APIs.
- [x] Add admin unified list/approve/reject APIs.
- [x] Replace hardcoded SM activities and local requests with real APIs.
- [x] Wire the SM workspace admin flap to the unified SM inbox while leaving GM behavior unchanged.
- [x] Verify ownership, idempotency, server-derived summaries, rejection, review replay, and questionnaire preservation through authenticated API checks on the isolated test SM fixture.
- [x] Apply the proven additive migrations to production and verify RLS, grants, constraints, indexes, advisors, and aggregate counts.
- [x] Run backend/frontend production builds, focused SM tests, the full backend suite, and authenticated API checks. Browser rendering remains a manual visual check because the in-app browser has no authenticated SM session.

## Verification record

Verified on 2026-08-26:

- Backend TypeScript production build: passed.
- Frontend Next.js 16.1.6 production build: passed, including all 45 routes.
- Authenticated owner/admin reads: test `sm` saw exactly their completed submission and request history; test `sm_admin` successfully loaded the unified SM request inbox.
- Controlled answer-request lifecycle: first create `201`, identical retry `200` with `replayed=true`, changed-payload token reuse `409`, forged client summary replaced by the server-derived answer label, rejection `200`, repeated rejection replayed, answer unchanged.
- Controlled approval roundtrip on a separate optional text question with no logic rules: forward correction approved, exact `applied_answer_id` recorded, repeated approval replayed, reverse correction approved from the immutable original snapshot, and the typed original value restored exactly.
- Controlled questionnaire-delete-request lifecycle: first create `201`, identical retry `200` with `replayed=true`, changed-reason token reuse `409`, rejection `200`, repeated rejection replayed, submission stayed `submitted`.
- Permanent audit evidence: the two rejected test requests remain visible to the owner and admin; no request row was hard-deleted.
- A separate answer request created through the test-SM UI after the controlled run was detected as pending and deliberately left untouched; it was not mistaken for or closed as test cleanup.
- Production data invariants after the controlled test: questionnaire submission count remained `1`, active/current answer count remained `6`, duplicate-current-answer count remained `0`, and the test submission remained current/submitted. Total immutable answer versions became `8`, exactly reflecting the forward-and-restore approval pair; both approved requests have a non-null applied-answer audit link.
- Full backend suite: 70/74 passed. The four failures are pre-existing and outside this scope: one admin-Zeiterfassung default-pause expectation and three RED-month date-anchor expectations. Every SM visit/planning/sync test passed.
- Supabase security advisor: no new activity-table warning/error. Both backend-only request tables report the expected informational `RLS enabled, no policy` state because direct client grants are intentionally absent. The existing project-level leaked-password-protection warning is unrelated.
- Supabase performance advisor: no unindexed activity foreign key remains. Fresh indexes are naturally reported as unused informationally until production traffic exercises them.
