# SM questionnaire submission — LivingMD

Status: active implementation record
Started: 2026-08-26
Owner: Coke Spark implementation thread
Scope: real Shelf Merchandiser questionnaire loading, draft persistence, resume, validation, photos, timing, submission, and production-data verification

This document is the working source of truth for the SM questionnaire runtime. It is intentionally separate from the earlier data-model and planning documents: those describe the domain; this file records the evidence gathered from the GM runtime, the exact SM delta, the implementation decisions, the live Supabase audit, the work performed, and the final verification evidence.

## Update protocol

This file must be updated whenever one of these changes:

1. a GM behavior is discovered that affects SM correctness;
2. an SM implementation assumption is disproved;
3. runtime code or database behavior changes;
4. a verification scenario passes or fails;
5. a production-schema difference is found;
6. a remaining item is completed or newly identified.

The runtime is not considered complete because code exists. Completion requires evidence for every invariant and scenario in the verification matrix near the end of this document.

## Non-negotiable invariants

1. An SM can only read or mutate an assignment whose effective SM user ID is their own application user ID.
2. The browser never writes directly to SM questionnaire tables. All reads and writes go through the authenticated backend.
3. A questionnaire submission snapshots the exact published questionnaire, module, question, option, scoring, metric, and conditional-rule versions that applied when the visit began.
4. Later questionnaire editing never changes an existing draft or submitted visit snapshot.
5. Only one current submission may exist per assignment.
6. A retry must not create a second visit, a second final time submission, or a duplicate logical answer.
7. A stale browser response must never replace a newer local answer.
8. Navigating backward, forward, through quick navigation, to review, or out to “later” must first commit the latest answer to the durable local queue; network persistence runs in the background and must never block question navigation.
9. Required and optional semantics are enforced twice: immediately in the SM UI and authoritatively by the backend at final submission.
10. Optional questions are skippable. Hidden questions are neither displayed nor required.
11. When conditional logic hides a previously answered question, its answer becomes invalidated rather than silently counting toward the submission.
12. A required matrix is complete only when every configured row has a valid selected cell.
13. A required photo question is complete only when at least one committed file row exists; a local preview or an unfinished upload is not enough.
14. Photo storage remains private. Upload paths must be server-issued and ownership-checked before commit or deletion.
15. A submitted questionnaire is immutable through the draft endpoints.
16. Discard is a deliberate soft-delete workflow for the questionnaire runtime graph and restores only the assignment state that existed before the visit began.
17. Time values are validated on both sides. End must be after start, elapsed time must be 1–1440 minutes, and manual duration must be 1–1440 minutes.
18. The SM production route must use the real runtime in development and production. The all-question-types preview must never intercept a normal assignment.
19. A preloaded payload is always bound to the currently authenticated user and exact assignment, is purged on identity change/logout, and remains available for an active visit for up to 30 days.
20. No database DDL or production-data mutation is made until its necessity is proven against the live schema.

## Evidence sources inspected

### GM runtime

- `src/app/(dashboard)/gm/marktbesuch/page.tsx`
- `src/components/dashboard/MarketList.tsx`
- `src/components/dashboard/ActivityLauncher.tsx`
- `src/components/dashboard/KuehlerInventurCard.tsx`
- GM visit API and cache helpers in `src/lib/api/backend.ts`
- GM visit-session routes and answer validation in the backend

### Existing SM runtime

- `src/app/(dashboard)/sm/marktbesuch/page.tsx`
- `src/components/dashboard/SmDashboardSchedule.tsx`
- `src/components/dashboard/AssignmentList.tsx`
- `src/components/sm/SmVisitWorkspace.tsx`
- `src/components/sm/SmPausedVisitNotice.tsx`
- `src/types/smVisit.ts`
- SM API helpers in `src/lib/api/backend.ts`
- `backend/src/routes/sm-visits.ts`
- `backend/src/sm-visit.shared.ts`
- `backend/src/sm-visit.shared.test.ts`
- SM schema mappings in `backend/src/lib/schema.ts`
- migrations `0089`, `0090`, `0091`, `0092`, `0093`, `0097`, and `0098`

### Existing design documents

- `docs/sm-questionnaire-data-model.md`
- `docs/sm-marktbesuch-implementation-plan.md`
- `docs/sm-living-spec.md`

### Live Supabase project

- Project: `Coke Spark`
- Project ref: `quqefecmqeienxmeueqa`
- Region: `eu-west-1`
- PostgreSQL: 17
- Inspection method: Supabase management tools and read-only catalog SQL

## What the GM runtime actually does

### 1. Preflight before navigation

The GM flow does not blindly open the questionnaire route and then discover whether it can load. Its launchers perform a preflight first:

1. verify the surrounding business prerequisites;
2. determine whether the user is resuming a known session or starting a new market/campaign combination;
3. fetch the complete existing session for resume, or fetch an exact start payload for a new visit;
4. write that payload into an auth-scoped in-memory and `sessionStorage` cache;
5. navigate only after the preflight succeeds;
6. show launch progress while this work happens.

This design gives the destination route immediately usable data while still allowing a fresh network reconciliation.

### 2. Cache boundaries

The GM cache has these important properties:

- owner user ID is stored in the envelope;
- the key contains the exact visit identity;
- entries live in memory and `sessionStorage` as a reload-safe fallback;
- entries expire after ten minutes;
- malformed, stale, owner-mismatched, or identity-mismatched entries are removed;
- auth-session changes purge the cache;
- a separate, shorter handoff cache supports leaving and resuming an active visit.

The SM flow needs the same guarantees, with `assignmentId` as the exact identity. It does not need campaign or cooler-unit dimensions.

### 3. Route bootstrap and stale-request protection

The GM destination route:

1. reads exact route parameters;
2. consumes a valid preload when present;
3. reconciles a requested resume session;
4. checks for an existing active exact visit when no explicit session is supplied;
5. fetches a fresh start payload otherwise;
6. uses request/run identity guards so a late result from an older bootstrap cannot overwrite the current route state;
7. removes stale closed-session state and gives the user a retry path;
8. renders a dedicated “visit is being prepared” state during bootstrap.

### 4. Immutable runtime snapshot

The GM session payload is not rendered directly from mutable authoring tables. The concrete visit owns section and question snapshots, including:

- questionnaire/module labels and order;
- question type, text, required flag, config, and options;
- chain applicability;
- conditional rules;
- existing answers, comments, photos, and photo tags.

The SM database already follows this snapshot model with `sm_questionnaire_submission_sections` and `sm_questionnaire_submission_questions`.

### 5. Resume hydration

GM reconstructs the exact UI answer shape for every supported type, not only primitive text:

- single and yes/no choice;
- multiple choice;
- yes/no-multi top answer plus branch sub-options;
- numeric, slider, and Likert values;
- matrix values by matrix subtype;
- photo metadata, signed previews, and tag state;
- comments.

SM currently hydrates its normalized answer union and committed photo files from the payload. Its matrix runtime is deliberately the SM boolean-cell model, not the GM date/text subtype model.

### 6. Required, optional, and hidden behavior

GM completion rules are type-aware:

- optional questions can be skipped;
- required text must contain non-whitespace text;
- required single/yes-no must contain a published option;
- required multi needs at least one published option;
- required yes/no-multi needs its top option and valid branch values;
- required numeric must be finite and satisfy configured bounds/precision;
- required matrix must satisfy the subtype-specific completeness rule;
- required photo needs committed photos and any configured tag requirements;
- questions hidden by conditional logic or chain applicability are excluded from navigation and required validation.

The GM backend is final authority and returns the concrete missing question IDs when submission is blocked.

### 7. Autosave and navigation

GM updates the answer state immediately and uses per-question debounced autosave with signatures to avoid unchanged writes. Ordinary Next/Back navigation is controlled by question completeness, not by the answer request, so the UI does not wait for a network round-trip. GM tracks timers and in-flight work and flushes before final submission or an explicit leave/finish-later transition.

The useful behavior to carry to SM is the separation between navigation and network persistence. The extra SM requirement is stronger field reliability: the latest normalized answer must be written to a durable, auth-scoped local queue before navigation, then synchronized in order. A failed network request may block final submission, but it must not strand the user on the current question.

### 8. Conditional logic

GM derives hidden questions from current answer values and published show/hide rules. Hidden questions do not count as missing. The server recomputes visibility after answer changes so the client cannot force a hidden answer to count.

SM already snapshots the rule graph and recomputes applicability in the backend. When a previously answered question becomes hidden, the server marks that answer invalidated and records an event.

### 9. Photos

GM uses a staged flow:

1. initialize or identify an answer;
2. ask the backend for a signed upload target;
3. upload the binary directly to private storage;
4. commit trusted metadata through the backend;
5. render only committed file records as saved;
6. validate photo requirements again before submit;
7. delete through an ownership-checked backend endpoint.

SM already implements the same security boundary without inheriting GM photo-tag semantics.

### 10. Leaving, resuming, and discarding

GM flushes pending work before leaving. “Finish later” preserves the draft; explicit cancellation/discard is a separate destructive choice. Resume restores the exact draft. A stale or already closed visit is cleared instead of reopening as editable.

### 11. Timing and final submission

GM flushes answers first, validates required questions and photo state, validates time values, then calls the authoritative backend submit endpoint. The backend revalidates and atomically closes the session.

SM follows the same two timing modes:

- timer mode stores start/end timestamps and derives elapsed minutes;
- manual mode stores a duration and no artificial timestamp pair;
- travel time is optional and only available when enabled for the SM account.

## Existing SM implementation — confirmed strengths

### Backend and ownership

- `/sm/visits` is protected with `requireAuth(["sm"])`.
- Every operation resolves the authenticated application user and checks the assignment’s effective SM owner.
- Start, answer, photo, discard, and submit operations use transactions and assignment/question advisory locks where required.
- An existing current submission is returned instead of creating a second visit.
- Assignment states `cancelled`, `missed`, and `completed` cannot start.

### Snapshot creation

- Start resolves an explicitly bound published questionnaire version, or a single effective published version.
- The selected version is bound to the assignment.
- Runtime sections and questions snapshot exact versions, labels, required flags, configs, options, metrics, and conditional rules.

### Answer persistence

- Answer payloads are strictly validated with Zod and normalized against the published snapshot.
- Unknown/tampered option codes and matrix axes are rejected.
- Numeric bounds and integer-only configuration are enforced.
- Unchanged normalized answers do not create a new version.
- Changed answers create a new `sm_question_answers` version and supersede the old current answer.
- Normalized option and matrix child rows are stored.
- An append-only answer event records each set/clear/state transition.
- Applicability is recomputed after answer and photo mutations.

### Submit and discard

- Submit recomputes applicability and checks only applicable required questions.
- The backend returns concrete missing submission-question IDs.
- Submit writes the final assignment time and closes questionnaire and assignment atomically.
- Repeated submit returns the existing receipt.
- Draft endpoints reject submitted visits.
- Discard soft-deletes the runtime graph, restores the pre-start assignment status, records an assignment event, and removes storage objects best-effort after the transaction.

### Live production schema

The required SM authoring, snapshot, answer, planning, message, and time tables are present. The runtime tables currently contain zero rows because no real SM questionnaire has been published/submitted yet. The schema includes:

- one-current-submission-per-assignment uniqueness;
- start-token uniqueness per SM user;
- one-current-answer-per-submission-question uniqueness;
- immutable answer version numbering;
- composite foreign keys preventing cross-submission child rows;
- active-only uniqueness for option and matrix children;
- soft-delete consistency checks;
- supporting indexes for assignment, submission, answer, metric, and audit lookups.

All SM tables have RLS enabled and are locked to `service_role`; `anon` and `authenticated` have no direct table grants. The private `sm-visit-photos` bucket exists with a 15 MiB limit and JPEG/PNG/WebP allowlist.

## Confirmed gaps before implementation

### Release blockers

1. `SmDashboardSchedule` adds `preview=all-types` to every development launch, so local “Starten” never exercises the real runtime.
2. SM navigation does not preload. The dashboard calls `router.push` immediately and the destination begins its first fetch from an empty state.
3. SM has no auth-scoped assignment preload cache or auth-change purge for that cache.
4. Previous-question and quick-navigation actions change the index without flushing the current draft. The autosave cleanup can cancel the pending timer, losing the latest edit.
5. The current save model allows multiple requests to overlap and relies on response sequence only. Ignoring an old response does not stop a delayed old request from becoming the server’s last write.
6. Final-submit errors are flattened to a message; the UI does not consume backend missing-question IDs to route the user to the concrete required question.
7. There are unit tests for normalization and conditional visibility, but no SM route lifecycle/integration coverage.

### Reliability gaps

8. Each autosave refetches the entire visit payload. This is correct but chatty and makes response-ordering harder.
9. Start tokens are stored under an assignment-only `localStorage` key rather than an auth-scoped runtime helper.
10. Photo batch upload has no client cleanup/reconciliation policy if one file uploads and a later file or final commit fails.
11. “Finish later” flushes the current draft, but page/browser lifecycle events do not provide a best-effort warning for unsaved work.
12. No explicit UI state distinguishes “preflight failed before navigation” from an ordinary dashboard load failure.

### Verification gaps

13. No real SM questionnaire data currently exists in production, so database structure can be verified read-only but a real production submission must not be fabricated as test data.
14. Browser E2E needs either a deliberately published test questionnaire assigned to the existing test SM, or an isolated non-production fixture. This is an evidence requirement, not permission to seed temporary production rows.

## Implementation plan

### Phase A — remove the false runtime path

1. Stop adding `preview=all-types` for normal dashboard launches.
2. Keep the explicit developer preview route available only through its dedicated development page.
3. Ensure `/sm/marktbesuch?assignmentId=...` always renders `SmVisitWorkspace` unless the caller deliberately uses the dedicated preview page.

Acceptance: a local dashboard assignment invokes the real `GET /sm/visits/:assignmentId` path.

### Phase B — GM-equivalent preflight and cache

1. Add an SM preload envelope containing owner user ID, assignment ID, creation time, and `SmVisitPayload`.
2. Store it in memory, `sessionStorage`, and auth-scoped `localStorage` with a 30-day active-field TTL.
3. Validate owner, assignment ID, payload assignment ID, and payload structure on every read.
4. Remove invalid/stale entries immediately.
5. Purge SM preload entries whenever auth-scoped client state is purged.
6. Proactively fetch/cache visible assignments on the dashboard.
7. On Start/Fortsetzen, navigate immediately when an exact cached payload exists; otherwise fetch once, cache, then navigate.
8. Disable only the selected action while an uncached preflight is active and show a compact loading indicator; keep the user on the dashboard with an actionable error after failure.
9. In `SmVisitWorkspace`, seed state from a valid cache synchronously, then reconcile with a fresh request guarded by a bootstrap sequence.

Acceptance: successful launch opens with already available payload; cache from another user or assignment is rejected; failed preflight does not navigate.

### Phase C — ordered, lossless draft persistence

1. Replace the single global debounce timer with a per-active-question save coordinator.
2. Keep one ordered write pipeline. A new edit while a write is running becomes the next latest write rather than a parallel request.
3. Coalesce intermediate drafts, but never drop the latest draft.
4. Track saved signatures by submission-question ID.
5. Update the local payload and durable queue synchronously; only hydrate a server response when it has not been superseded by a newer local edit.
6. Next, Previous, quick navigation, and entry into review enqueue/flush in the background and transition immediately after local required/photo validation.
7. Finish-later may proceed when the answer is durably queued locally; final submission must wait until the queue is synchronized online.
8. Preserve the current draft and retry automatically on reconnect or after one reconciled version conflict.

Acceptance: rapid edits, rapid next/back, and quick-nav changes are never network-blocked, survive refresh/offline use, and converge to the newest value in the backend after reconnect.

### Phase D — required/optional and conditional behavior

1. Keep type-aware local completeness checks aligned with backend normalization.
2. Allow Next on incomplete optional questions, saving an explicit empty answer only when the user actually cleared a previously saved answer.
3. Block Next on incomplete required questions with a focused inline error.
4. Rebuild the visible flattened question list from the reconciled payload after every conditional answer.
5. Clamp or relocate the current index when the active branch hides questions.
6. At submit, parse backend `details.questionIds`, return to the first missing visible question, and mark all returned questions in quick navigation.

Acceptance: optional questions skip; required questions block; hidden required questions do not block; a newly revealed required question does block.

### Phase E — photos

1. Keep initialize → presign → upload → commit as the only saved-photo path.
2. Treat only backend file IDs as answered state.
3. Prevent navigation/submit while uploads are active.
4. On partial batch failure, refetch authoritative state and clearly report which files were not committed.
5. Keep delete ownership checked and refetch after successful delete.
6. Verify required-photo behavior against committed rows, not previews.

Acceptance: upload retry cannot falsely satisfy a required photo; deleted/failed files do not count.

### Phase F — timing, submit, receipt, resume, and discard

1. Flush the latest answer before review and again before submit.
2. Validate timestamp pair and manual duration locally.
3. Keep backend validation authoritative.
4. Map missing-required backend details into UI navigation.
5. Clear preload/start-token/paused-notice state only after confirmed submit or discard.
6. Resume a draft from the authoritative payload at the first incomplete required question or the last known position when safely available.
7. Submitted assignments render receipt/read-only completion behavior and never reopen as a draft.

Acceptance: double submit returns one receipt/time row; refresh resumes; finish later resumes; discard restores assignment and removes the current draft.

### Phase G — tests and production verification

1. Expand shared unit tests across all answer types, empty/required semantics, matrix completeness, and conditional invalidation inputs.
2. Add route-level tests for ownership, start idempotency, answer versioning, hidden-answer rejection, required submit, submit idempotency, and post-submit immutability.
3. Add deterministic tests for the client save coordinator and cache validation where the project test setup permits.
4. Run frontend type/build checks and backend build/unit tests.
5. Inspect live schema, migrations, policies, grants, indexes, constraints, and storage bucket again after implementation.
6. Run Supabase security and performance advisors after any DDL. No DDL is currently planned because the live schema already supports the runtime.
7. Perform browser E2E only with an authorized real test questionnaire/assignment, not synthetic production records.

## Plan self-review — thought experiments

The plan was reread against the following situations before coding.

| Situation | Expected behavior | Plan coverage |
| --- | --- | --- |
| Start tapped once on a slow connection | dashboard shows selected-button progress; navigation occurs only after payload arrives | Phase B |
| Start double-tapped | second tap is disabled; backend current-submission uniqueness is a second guard | B, backend invariant |
| Cache belongs to previous login | owner mismatch purges it; fresh request is required | B |
| Cache is ten minutes old | entry is purged; fresh request is required | B |
| User edits text and instantly taps Next | latest draft is queued locally first; navigation moves immediately; ordered sync follows | C |
| User edits then taps Previous | same local-queue rule; debounce cleanup cannot lose the draft | C |
| User edits then selects question 8 in quick nav | local queue captures the edit and quick navigation moves immediately | C |
| Two edits happen while first save is in flight | second becomes queued latest write; no overlapping stale final write | C |
| Network returns an old response after a new local edit | response cannot hydrate over a newer local signature | C |
| Optional question is blank | Next is allowed; submit ignores it | D |
| Required text contains spaces | local and backend treat it as unanswered | D + existing normalization |
| A trigger hides a required answered question | server invalidates answer; question disappears and no longer blocks | D + existing backend |
| Trigger later reveals it again | it returns unanswered and blocks if required; invalidated answer is not resurrected silently | D |
| Required matrix has only some rows | local Next and backend submit both block | D |
| Photo preview exists but commit failed | it does not count; required photo remains incomplete | E |
| One file in a photo batch fails | authoritative refetch shows only committed files and reports failure | E |
| Browser refreshes during a draft | GET rebuilds exact snapshot and answers; start endpoint is not called again | B/F |
| User chooses “later” during a failed save | dialog remains; navigation does not occur | C/F |
| Submit is tapped twice | backend returns the same submitted receipt and only one current time row exists | F + existing backend |
| Old tab tries to edit after submit | backend rejects because assignment/submission is no longer draft | existing backend |
| Assignment belongs to another SM | every route rejects before returning data | existing backend/test requirement |
| Questionnaire author edits question after start | runtime snapshot remains unchanged | existing schema/test requirement |
| Once-per-market questionnaire already completed | start is rejected authoritatively | existing backend/test requirement |
| End timestamp precedes start | client and Zod submit schema reject | existing backend + F |
| Travel time disabled for account | input is absent and backend rejects injected travel values | existing backend/F |

Conclusion of self-review: the database model is sufficient. The highest-risk missing work is client orchestration—real-route launch, preflight cache, ordered saves, transition flushes, and structured submit-error handling. DDL would not solve those failures and is therefore not justified at this stage.

## Live Supabase audit — 2026-08-26

### Applied migrations confirmed

- `create_sm_markets`
- `sm_questionnaire_domain`
- `sm_questionnaire_fk_indexes`
- `sm_enforce_soft_deletes`
- `sm_market_assignments`
- `sm_planning_domain`
- `sm_planning_composite_fk_index`
- `sm_planning_least_privilege`
- `sm_messages`
- `sm_visit_runtime_timing`
- `sm_visit_photo_bucket`

### Runtime row counts at audit time

- `sm_assignments`: 4
- `sm_questionnaire_submissions`: 0
- all SM authoring/version tables: 0
- all SM answer/snapshot/event/file tables: 0

Interpretation: the schema is deployed but no real SM questionnaire content has yet produced a runtime submission.

### Security boundary

- All SM tables report RLS enabled.
- No `anon` or `authenticated` table grants were found for SM tables.
- `service_role` has the intended backend privileges.
- No permissive direct-client policies were found.
- `sm-visit-photos` is private, limited to 15 MiB, and restricted to JPEG/PNG/WebP.

### Constraints and indexes confirmed

- `sm_questionnaire_submissions_current_assignment_unique`
- `sm_questionnaire_submissions_client_token_active_unique`
- `sm_questionnaire_submissions_once_per_market_unique`
- `sm_question_answers_current_question_unique`
- `sm_question_answers_question_version_unique`
- composite submission/section/question/answer foreign keys
- active child uniqueness for answer options, matrix cells, and file paths
- visit-mode, duration, timestamp-order, submit-state, and soft-delete checks

### Separate legacy security finding

The Supabase table inventory also reports many older non-SM public tables with RLS disabled. This predates and is separate from the SM runtime. It must not be auto-fixed as part of this task because enabling RLS without matching policies could break the existing GM/admin application. It must be surfaced to the user as a separate security decision.

## Implementation log

### 2026-08-26 — discovery and plan

Completed:

- traced GM preflight, cache, bootstrap, hydration, validation, conditional logic, autosave, photo, timing, leave/resume, and submission behavior;
- traced existing SM frontend, API, backend route, shared validator, schema, migrations, and tests;
- inspected the live Coke Spark Supabase tables, row counts, migrations, security posture, constraints, indexes, and photo bucket;
- identified the temporary-development interception, absent preload, and draft-loss navigation paths;
- self-reviewed the plan against failure and retry scenarios;
- concluded no schema migration is currently required.

### 2026-08-26 — Phase A completed: real runtime only

Implemented:

- removed the development-only `preview=all-types` interception from the normal `/sm/marktbesuch` route;
- removed preview query parameters from dashboard assignment launches;
- kept temporary all-type rendering isolated under `/dev/sm-visit-preview` so UI work remains possible without contaminating production behavior;
- normal Start/Fortsetzen links now contain only the real assignment ID and always enter `SmVisitWorkspace`.

Why this works:

- the dashboard can no longer silently substitute a fake payload;
- the page route has one production code path, making browser/API behavior representative;
- the explicit developer page cannot persist to production because it owns its temporary payload locally.

### 2026-08-26 — Phase B completed: GM-equivalent preflight and auth-scoped cache

Implemented:

- the dashboard proactively calls `GET /sm/visits/:assignmentId` for visible assignments;
- Start/Fortsetzen navigates immediately when an exact cached payload exists and performs an uncached preflight otherwise;
- the selected assignment displays a loading indicator and all launch actions are temporarily disabled, preventing double launch;
- failed preflight stays on the dashboard and shows a launch-specific error;
- successful preflight writes an envelope to memory, `sessionStorage`, and `localStorage` with:
  - authenticated user ID;
  - assignment ID;
  - creation time;
  - full `SmVisitPayload`;
- cache entries expire after 30 days and are rejected when owner, assignment, payload assignment, answer-version map, sections, answers, or photo maps do not match the expected shape;
- invalid and stale entries are removed immediately;
- auth logout/identity switch purges SM preload memory, SM preload session storage, and SM start tokens;
- `SmVisitWorkspace` hydrates from a valid cache synchronously and always performs a fresh authoritative reconciliation guarded by a load-sequence counter;
- submit and discard clear the assignment cache and auth-scoped start token.

Why this works:

- the loading cost occurs before route transition, matching the useful GM behavior;
- cached data can never cross users or assignments;
- cache is only a fast first paint, never the final authority;
- sequence guards prevent a late bootstrap request from replacing a newer reload.

### 2026-08-26 — Phase C completed: ordered, lossless answer persistence

Implemented:

- the workspace keeps authoritative payload, active question, and latest draft in refs so event handlers do not save stale render values;
- all answer writes pass through one serialized promise queue;
- exact same question/value writes share one in-flight promise instead of producing duplicate rows/events;
- text and numeric input retain a short debounce; selection types use a shorter debounce;
- Previous, Next, quick navigation, and review commit the latest answer to the local queue and transition without awaiting the network;
- Finish later accepts a durably queued offline answer, while Submit waits for the queue to synchronize authoritatively;
- blank never-saved optional answers produce no unnecessary database row;
- clearing a previously saved optional answer persists an explicit empty normalized answer;
- a server payload is allowed to update the local draft only when the user has not typed a newer local value;
- browser unload warns only for a hard synchronization error; queued answers already survive in user/assignment-scoped local storage, and visibility loss triggers a best-effort sync;
- edits clear stale submit/save messages immediately.

Why this works:

- only one answer request can mutate the submission at a time in one client;
- navigation cannot cancel the only pending copy of a draft because that copy exists locally before the transition;
- an old response cannot hydrate over a newer local edit;
- explicit clear and untouched optional are intentionally different states.

### 2026-08-26 — optimistic concurrency completed

Implemented:

- visit payloads now expose `answerVersions` for every snapshotted question;
- answer PUT requires `expectedAnswerVersion` and a unique `clientMutationToken`;
- backend uses a question-scoped PostgreSQL advisory transaction lock;
- backend checks same-content idempotency before version conflict, so replaying an already-applied request succeeds;
- a real stale write returns HTTP 409 with `sm_visit_answer_version_conflict` and current version details;
- client reconciles the authoritative visit after a conflict while retaining a newer local draft for review/retry;
- each successful answer creates the next immutable answer version/event and recomputes conditional applicability transactionally.

Why this works:

- serialization in one tab prevents local races;
- expected versions prevent two tabs/devices from silently overwriting one another;
- idempotent same-content handling tolerates a lost response followed by a retry.

### 2026-08-26 — Phase D completed: required, optional, and conditional rules

Implemented:

- local completeness follows the same per-type semantics as backend normalization;
- required questions block Next and are highlighted in the question card and quick navigation;
- optional questions can be skipped;
- whitespace-only text is incomplete while exact non-empty user text is preserved;
- multi, yes/no multi, single, yes/no, likert, slider, numeric, matrix, and photo completeness are type-aware;
- matrix requires one valid cell for every published row;
- photo completeness counts committed backend file IDs, not browser previews;
- after every save, backend recalculates show/hide rules and returns the authoritative visible snapshot;
- resolved or newly hidden missing-question markers are pruned;
- quick-navigation closes with a clear message if its target became hidden during the flush;
- submit consumes structured `sm_visit_required_answers_missing.details.questionIds`, closes review, highlights all missing questions, and routes to the first visible missing question.

Why this works:

- frontend gives immediate guidance, while backend remains the final authority;
- hidden required questions cannot block submission;
- answers invalidated by a hidden branch cannot silently return when the branch is shown again.

### 2026-08-26 — Phase E completed: committed-photo semantics and cleanup

Implemented:

- photo flow is initialize answer → presign one file → upload → commit one file;
- multi-file selection commits incrementally, so earlier successful files survive a later-file failure;
- client accumulates every committed file ID rather than returning only the final file;
- navigation and submit are blocked while photo work is active;
- any failure triggers authoritative payload reconciliation;
- an uncommitted upload receives a best-effort authenticated cleanup request;
- cleanup validates assignment ownership, draft state, answer ownership, photo type, expected storage prefix, path traversal, and whether the path is already committed before removing an object;
- deleting a committed photo soft-deletes the database row transactionally, updates answer state/applicability, and then best-effort removes the private storage object with structured warning logs on storage failure.

Why this works:

- only committed file rows satisfy required-photo rules;
- cleanup cannot delete another SM's file or an already committed file;
- database state stays authoritative even if storage cleanup has a transient failure.

### 2026-08-26 — Phase F completed: timing, submit, receipt, resume, and discard

Implemented/confirmed:

- manual-start remains available regardless of whether the account collects travel time; the travel-time account flag only controls the Fahrtzeit field and accepted value;
- timer/manual mode, visit timestamps, manual duration, timestamp ordering, and travel-time authorization remain backend validated;
- review and submit flush the latest answer before continuing;
- submit validates only applicable required questions and returns their IDs structurally;
- backend transaction marks submission and assignment completed, creates the immutable submission event, and writes the one-current SM time row/receipt;
- repeated submitted-state reads return the receipt rather than reopening a draft;
- Finish later returns to the dashboard without deleting the draft; a subsequent GET resumes from the immutable snapshot and current answers;
- discard requires an explicit confirmation string, soft-deletes the submission graph, restores the assignment's prior actionable status, and clears client runtime state only after success;
- start token keys now include the authenticated user ID and assignment ID.

Why this works:

- timing cannot be forged merely by bypassing the phone UI;
- immutable questionnaire snapshots protect an in-progress visit from later author edits;
- submit/discard side effects are transactional and current-row uniqueness prevents duplicate completion rows.

## Final implemented data flow

1. SM taps Start/Fortsetzen on `/sm`.
2. Dashboard uses the proactively cached owned assignment/visit payload immediately, or performs one uncached preflight for questionnaire availability, current submission, answers, versions, and files.
3. Successful payload is cached for the same authenticated user/assignment and the route opens.
4. Workspace paints from cache, then reconciles from the backend.
5. Starting creates or reuses one current draft submission and snapshots the published questionnaire graph.
6. Each edit updates the local graph and durable queue first; ordered background sync normalizes and versions it under a transaction/advisory lock, with conditional applicability recomputed in the same transaction.
7. After queue replay, the client reconciles the authoritative graph while retaining any newer local draft.
8. Photos count only after private-storage upload and database commit.
9. Review/submit flushes the latest draft; backend rejects applicable missing required IDs structurally.
10. Successful submit completes submission/assignment and creates the time receipt once.
11. Completed GETs render receipt state; drafts remain resumable; explicit discard soft-deletes and restores the assignment.

## Post-implementation live Supabase reconciliation

No migration was created or applied in this implementation pass. The already-applied runtime migrations contain every column, constraint, index, bucket, and privilege needed by the implemented endpoints, including answer versioning and client mutation tokens. Adding duplicate DDL would have increased production risk without closing a real gap.

Read-only post-change checks confirmed:

- all 29 `sm_` tables still have RLS enabled;
- zero SM tables grant direct access to `anon` or `authenticated`;
- backend `service_role` remains the only application data path;
- private `sm-visit-photos` settings remain 15 MiB and JPEG/PNG/WebP;
- production still has 4 assignments and zero questionnaire submissions/answers/files, so no production data was modified for testing;
- Supabase security advisors return 33 expected SM informational `rls_enabled_no_policy` findings because direct client grants are revoked;
- the only project security warning is Auth leaked-password protection being disabled;
- performance advisors show unused SM indexes, which is expected with empty runtime tables and is not evidence that those integrity/query indexes should be dropped;
- 71 older non-SM public tables still have RLS disabled; this is a separate legacy security decision and was intentionally not changed.

Relevant Supabase guidance:

- RLS: <https://supabase.com/docs/guides/database/postgres/row-level-security>
- leaked-password protection: <https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection>
- unused-index advisor: <https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index>

## GM save-flow comparison and SM offline correction — 2026-08-26

Observed GM behavior:

- answer controls update React state immediately;
- next/back navigation depends only on question completeness, not on the answer API;
- answer writes are debounced per question and run in the background;
- pending writes are flushed before final submission or leaving through the explicit “later” workflow;
- the GM preload/handoff caches improve startup and resume behavior, but they do not provide a complete durable offline mutation queue.

Previous SM behavior and root cause:

- selecting an answer started a debounced write;
- each write waited for `PUT /answers/:questionId` and then fetched the entire visit again;
- next/back/quick navigation awaited this full save-plus-refetch chain;
- the question button displayed a loader and became disabled for both network round-trips;
- the preload cache lived only in session storage for ten minutes, so it was not sufficient for a disconnected field workflow.

Implemented SM behavior:

- answers update the local payload and conditional visibility immediately;
- required questions still block navigation locally, while optional questions remain skippable;
- `Weiter`, `Zurück`, and quick navigation never wait for answer persistence and never show a save spinner in the button;
- the header uses passive, non-spinning states: `Auf Gerät gesichert`, `Synchronisiert`, `Offline gesichert`, or `Synchronisierung offen`;
- the latest answer per question is stored in a versioned, user-and-assignment-scoped local queue before navigation can occur;
- rapid edits coalesce to the latest value while preserving the correct baseline answer version;
- an edit made while an older value is in flight remains queued and is written after the older response, preventing a lost-revert race;
- reconnect triggers serialized queue replay; one version conflict is reconciled against the fresh server version and retried;
- a single server refresh after replay reconciles authoritative applicability, invalidated answers, counts, and versions;
- dashboard visits for the selected day are proactively preloaded, and a cached visit can still be opened if the launch refresh fails;
- cached visit payloads use local storage plus memory/session fallbacks, expire after 30 days, and are purged on logout or identity switch;
- final submission remains online-only because authoritative required-answer validation, timing validation, immutable snapshot submission, and receipt creation must run transactionally on the server;
- photo capture/upload remains connection-dependent because a photo is only complete after private-storage upload and server commit. No UI pretends that an uncommitted local photo is saved.

No schema, RLS, storage policy, or production row was changed for this correction.

### Follow-up after field feedback — non-blocking navigation and offline reopen

Field testing showed that the remaining save indicator still looked like a blocking operation and that an offline dashboard reload did not retain the schedule row needed to reopen a cached visit. The runtime was tightened as follows:

- the transient `saving` state was removed from the SM question UI; the local-first state is now explicitly `local` and renders as the passive text `Auf Gerät gesichert` with no spinner;
- answer selection writes the latest normalized value to the durable user/assignment queue before any navigation or background request;
- `Weiter`, `Zurück`, and quick navigation release the UI transition first and schedule the server write on the background event queue; none of these handlers awaits the API;
- a never-touched empty optional answer is no longer written merely because the user navigated past it, while clearing a previously saved answer still creates the required new answer version;
- `Später fortsetzen` now leaves as soon as the local queue contains the latest answer; synchronization continues in the background and on the next reconnect;
- the local payload is still overlaid with the durable queue on reload, so a fresh server response cannot erase a newer offline answer;
- the owned SM planning range is cached for 30 days under the authenticated user ID. When the planning API is unavailable, the dashboard retains the last loaded assignments and can reopen their exact cached visit payloads;
- planning, visit, and pending-answer caches are all purged on logout or identity switch.

Offline boundary: ordinary answer types and navigation work from the cached active visit. Final submission remains online-only, and photo questions remain online-dependent until their private-storage upload and server commit have completed. This is intentional; the UI must never represent an uncommitted photo or an unvalidated final submission as saved.

No database or production-data change is required for this follow-up.

Verification: the full Next.js 16.1.6 production build completed successfully, including TypeScript checks and all 45 app routes; the running local frontend preview and backend health endpoints both returned HTTP 200.

## Visit session → SM Zeiterfassung extension — 2026-08-26

### Session identity and ownership

No second, redundant `sm_visit_sessions` table was added. The current `sm_questionnaire_submissions` row is the durable visit-session aggregate because it already owns:

- the exact assignment, SM user, and market identity;
- immutable questionnaire/module/question snapshots;
- visit mode, travel duration, start/end timestamps, draft/submitted state, and submission receipt;
- the answer/version/event/file graph;
- one-current-submission and client-start-token idempotency guarantees.

`POST /sm/visits/:assignmentId/start` creates or reuses that current draft and moves the assignment to `in_progress`. `POST /sm/visits/:assignmentId/submit` validates required answers again and closes the questionnaire submission, assignment, and current time submission in one transaction. A retry returns the existing receipt and cannot create a second current time row.

### Read model exposed to Zeiterfassung

SM planning reads now include, for each assignment:

- the current time row ID, revision, actual minutes, submitter, submitted timestamp, and correction reason;
- visit submission ID/status/questionnaire name/mode;
- visit time, travel time, start/end, and submitted timestamp;
- the current pending SM correction/deletion request, if one exists.

The personal SM Zeiterfassung page no longer uses hard-coded sample days. It loads only the authenticated SM's assignments for week/month/93-day ranges, groups real visits by date, shows planned time, visit time, travel time, total time, questionnaire state, and opens unfinished visits through the real assignment route.

The SM-admin Zeiterfassung uses the same read model and shows planned, visit, travel, and total time in a consistent grid. Pending employee requests appear on the affected row and can be approved or rejected without replacing the questionnaire/session record.

### Durable time correction requests

One additive production migration, `sm_zeiterfassung_requests`, created `sm_assignment_time_change_requests` with:

- exact assignment/user/source-time-revision binding;
- `time_change` and `deletion` request kinds;
- original/requested minutes, reason, status, reviewer/admin note, applied revision, and audit timestamps;
- one active pending request per assignment and idempotent client request tokens;
- soft-delete fields, consistency checks, and hard-delete/truncate rejection triggers;
- forced RLS, no `anon`/`authenticated` grants, and service-role-only select/insert/update privileges (no delete/truncate).

Approval is revision-safe: if the source time revision is no longer current, approval is rejected as stale. A time change creates the next immutable current revision; an approved deletion soft-deletes the current time row. Rejection only closes the request. Existing questionnaire submission/session data is not rewritten.

### Production verification

Preflight and postflight catalog checks confirmed the request table and composite time-row index did not exist before the migration and exist afterward. Assignment, time-submission, and questionnaire-submission counts were unchanged by DDL. Forced RLS and least-privilege grants were verified after apply.

Authenticated test-account API verification covered:

- personal SM planning read with real visit and time metadata;
- request creation and SM-admin rejection, leaving actual time unchanged;
- request creation and SM-admin approval, producing the next time revision;
- an authorized admin correction restoring the test assignment's original effective minutes;
- no pending request remaining after either review path.

The test account retains append-only audit rows for the rejected and approved test requests, while its effective current time was restored. No real GM, real SM, market, questionnaire, or non-SM production row was deleted or rewritten.

## Verification evidence — 2026-08-26

Automated and build evidence:

- frontend `npm run build`: pass; TypeScript passed and all 45 routes generated, including `/sm/marktbesuch` and `/dev/sm-visit-preview`;
- backend `npm run build`: pass;
- focused `npx tsx --test src/sm-visit.shared.test.ts`: 14/14 pass;
- the focused suite covers every answer family, empty/clear semantics, required matrix completeness, committed-photo completeness, rule-value extraction, conditional show/hide, option tampering, ordering/deduplication, numeric bounds/integer rules, and slider bounds/steps;
- full backend `npm test`: 70/74 pass; every SM test passes. Four pre-existing unrelated failures remain: one admin-Zeiterfassung default-pause expectation and three RED-Monat date-boundary expectations;
- standalone repository-wide `npx tsc --noEmit` is not clean because existing backend integration/test fixtures have unrelated type drift; the actual frontend production build and backend build both type-check successfully;
- backend `/health`: HTTP 200;
- unauthenticated `GET /sm/visits/:assignmentId`: HTTP 401;
- `git diff --check`: no whitespace errors in the current working changes.

Browser evidence:

- login page renders cleanly on the restarted local frontend;
- isolated `/dev/sm-visit-preview` renders the real SM start-card component with market/address, Fahrtzeit, timer start, and manual-skip controls;
- no production questionnaire data was created to force the authenticated real route.

Fixture boundary:

- a complete phone journey against `/sm/marktbesuch` is **not runnable without authorized fixture** because production contains zero published SM questionnaire versions and zero submissions;
- creating synthetic rows in this production database would contradict the database-safety requirement;
- the remaining runtime proof is: publish/assign one deliberately authorized SM test questionnaire, then execute the matrix below. The implementation does not require more DDL before that run.

## Verification matrix

Status values: `pending`, `pass`, `fail`, `not runnable without authorized fixture`.

| Requirement | Evidence required | Status |
| --- | --- | --- |
| Normal dashboard launch uses real runtime | source inspection + build | pass |
| Preflight completes before navigation | source inspection + build | pass |
| Cache is user/assignment scoped, durable, and purged on identity change | source proof + auth purge inspection | pass |
| Required questions block Next | shared validator + client/backend inspection | pass |
| Optional questions skip | shared validator + client/backend inspection | pass |
| Hidden required questions do not block | conditional shared tests + backend inspection | pass |
| Latest rapid edit wins | serialized queue + version-lock inspection | pass |
| Next/previous/quick-nav commit locally without waiting for network | transition-handler inspection + build | pass |
| Offline answers survive locally and replay on reconnect | durable queue + serialized replay/conflict inspection + build | pass |
| Final submit rejects an outstanding offline queue | finalize-path inspection + build | pass |
| Reload resumes exact answers | snapshot/read implementation | not runnable without authorized fixture |
| Photos save only after commit | shared photo test + client/backend inspection | pass |
| Partial photo failure is reconciled | client/backend inspection | pass |
| Submit returns missing IDs and UI routes to first | structured client/backend inspection | pass |
| Double start is idempotent | start token + DB uniqueness + route inspection | not runnable without authorized fixture |
| Double submit is idempotent | submitted receipt + DB uniqueness + route inspection | not runnable without authorized fixture |
| Post-submit edit is rejected | status guards + route inspection | not runnable without authorized fixture |
| Cross-SM access is rejected | ownership guard + unauth 401 | not runnable without authorized fixture |
| Discard soft-deletes graph and restores assignment | transaction/confirmation inspection | not runnable without authorized fixture |
| Time validation is authoritative | Zod/DB/route inspection | pass |
| Frontend production build | command output | pass |
| Backend build and focused SM unit tests | command output | pass |
| Full backend suite | 70/74; four unrelated existing failures | fail |
| Live schema remains aligned | post-change read-only audit | pass |
| Real phone-sized browser E2E | authorized published test content | not runnable without authorized fixture |

## Remaining-work rule

Items stay in this document until there is direct evidence they pass. A successful build is not evidence that persistence, retries, permissions, or conditional behavior work. Likewise, an empty production runtime table is not evidence that submission works; it only proves the schema is deployed and unused. The fixture-limited rows above must be executed before describing the real production phone journey itself as browser-verified.

## Authorized production SM test fixture — 2026-08-26

The user explicitly authorized additive realistic test data in the isolated SM domain so the real phone journey can be checked. The seed was created through the application's authenticated SM-admin APIs, not raw inserts. No delete operation, schema change, GM/admin-domain mutation, user mutation, or market mutation was performed.

Target account:

- `sm.test.20260813@cokespark.at` (`eff25681-6964-4593-b3e5-5778f6e8eebe`)

Published test questionnaires:

1. `TEST · Standardbesuch Marktcheck`
   - 6 questions;
   - yes/no, single choice, numeric, multiple choice, slider, optional text;
   - version `09a36bf2-389e-46d0-86bf-2af069770ad9`.
2. `TEST · OOS & Behebung`
   - 4 questions;
   - OOS detection and remediation metrics;
   - two conditional rules with four target links;
   - a required photo only when the OOS branch is active;
   - version `923eca9e-97bd-4d15-95b6-921a31dc0497`.
3. `TEST · Abschluss & Dokumentation`
   - 5 questions;
   - required matrix, required Likert rating, yes/no multi, optional photo and text;
   - version `005e66c7-f81a-4905-94e9-bad4b1cbcd3e`.

Assignments for Vienna date `2026-08-26`:

- `196dbb09-7f5e-4329-921e-6502b2c382b7` — Billa, Breitenleer Straße 148, 60 min, Standardbesuch;
- `1c0eb13e-5450-41c8-8a92-f4ad408e0323` — Billa Plus, Triesterstraße 64, 75 min, OOS & Behebung;
- `181da98d-0268-4d42-8171-29d907e2b2c6` — Billa, Am Europlatz 2, 45 min, Abschluss & Dokumentation.

Post-write verification:

- 3 active questionnaire templates;
- 3 published questionnaire versions;
- 3 modules and 3 published module versions;
- 15 snapshottable questions;
- 3 planned assignments and 3 creation events;
- test SM API sees exactly one questionnaire on each assignment;
- zero submissions were started, leaving the first Start action available for manual UI testing;
- the pre-existing matched-market count remains 1, confirming markets were not reassigned.
