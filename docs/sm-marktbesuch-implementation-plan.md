# SM Marktbesuch — implementation plan

Prepared: 2026-08-24 · Europe/Vienna

## Outcome

An authenticated Shelf Merchandiser opens a concrete assignment from the SM dashboard and completes the questionnaire version bound to that assignment. The flow is phone-first, resumes safely after reloads, never trusts a client-supplied SM user id, and preserves the exact published questionnaire wording and configuration used during the visit.

## Scope and fixed decisions

- The dashboard `Starten` action opens `/sm/marktbesuch?assignmentId=<id>`.
- Only the authenticated effective assignee can open or mutate an assignment.
- Cancelled, missed, completed, deleted, or foreign assignments cannot be started.
- An assignment must resolve to a published SM questionnaire version. Explicit assignment binding wins; a missing binding may use the single currently effective published version. Ambiguous or missing published versions produce an actionable error instead of silently choosing one.
- SM users with `sm_travel_time_enabled = true` see the GM-consistent start card. They may start the visit timer or choose manual visit time later. They also get an optional `hh:mm` Fahrtzeit input.
- SM users without Fahrtzeiten enter the questionnaire directly; the backend still creates the visit draft and server start timestamp.
- Timer/manual choice concerns visit duration. Fahrtzeit is a separate optional value.
- The final review always shows how visit duration is resolved. Timer visits use elapsed server time; manual visits require an explicit duration before submission.
- Saving an answer creates a new answer revision only when that one question's normalized payload changed. No unrelated answer, applicability state, or snapshot is rewritten.
- Published questionnaire content is immutable. A draft submission keeps its resolved snapshots even if admins publish later versions.

## Runtime state machine

```text
eligible assignment
  -> setup_required (Fahrtzeiten-enabled and no start mode chosen)
  -> draft/in_progress
  -> review
  -> submitted/completed
```

Recoverable states:

- Reopening `setup_required` shows the start card.
- Reopening `draft` returns to the last locally remembered question, bounded by the server-resolved question list.
- Reopening `submitted` shows a durable completion receipt and never creates a second submission.
- Repeating start, save, or submit requests with the same idempotency token returns the existing result.

## Data changes

Additive migration only:

- `sm_questionnaire_submissions.visit_time_mode`: nullable `timer | manual`.
- `sm_questionnaire_submissions.travel_minutes`: nullable integer, `0..1440`.
- `sm_questionnaire_submissions.manual_visit_minutes`: nullable integer, `1..1440`.
- Checks keep manual duration consistent with manual mode and reject invalid ranges.
- Existing rows remain valid because all new columns are nullable.
- RLS remains forced and backend-only, matching the other SM runtime tables.

On final submit, write a revision to `sm_assignment_time_submissions` and complete `sm_assignments` in the same transaction. Fahrtzeit stays on the immutable visit submission snapshot; it is not mixed into visit duration.

## Backend API

All routes require role `sm` and derive the user from the authenticated session.

### `GET /sm/visits/:assignmentId`

Returns:

- effective assignment and market snapshot;
- `travelTimeEnabled`;
- visit setup state and timing values;
- current draft/submitted receipt;
- resolved sections/questions in published order;
- current answers only;
- upload metadata for committed photos.

### `POST /sm/visits/:assignmentId/start`

Body: `{ mode: "timer" | "manual", travelMinutes?: number | null, clientSubmissionToken: string }`.

Atomically verifies ownership and eligibility, resolves a published questionnaire version, creates immutable section/question snapshots once, changes the assignment to `in_progress`, and sets server start timestamps for timer mode. Direct entry for non-Fahrtzeit SMs uses timer mode internally without showing setup.

### `PUT /sm/visits/:assignmentId/answers/:submissionQuestionId`

Body: `{ answer: SmVisitAnswerPayload, clientMutationToken: string }`.

The server validates the payload against the snapshot type/config/options, evaluates authoritative applicability, and versions only the changed answer. Identical normalized payloads are no-ops. Required validation is deferred until final submission.

### `PATCH /sm/visits/:assignmentId/timing`

Body supports optional Fahrtzeit and manual visit duration. Timing changes are allowed only while the submission is a draft.

### `POST /sm/visits/:assignmentId/submit`

Body: `{ clientMutationToken: string, actualMinutes?: number }`.

Re-evaluates applicability, rejects missing required applicable answers with question ids, writes final timing, marks submission and assignment complete, and returns a durable receipt. A repeated token or already submitted assignment returns the same receipt.

Photo upload uses a private SM visit bucket and server-authorized assignment paths. File metadata is linked to the current photo answer; deletion is soft-delete only.

## Answer payloads

- `yesno`, `single`, `likert`: `{ kind: "choice", optionCode: string }`
- `multiple`: `{ kind: "multi", optionCodes: string[] }`
- `yesnomulti`: `{ kind: "yesnomulti", optionCode: string, subOptions: string[] }`
- `text`: `{ kind: "text", value: string }`
- `numeric`, `slider`: `{ kind: "number", value: number }`
- `matrix`: `{ kind: "matrix", cells: [{ rowCode: string, columnCode: string, selected: boolean }] }`
- `photo`: `{ kind: "photo", fileIds: string[] }`
- clearing an optional answer: `{ kind: "empty" }`

## Phone UI by question type

Shared card:

- visually matches the GM question card, but uses 16 px readable question text, 44 px minimum controls, safe-area padding, and a single-column phone canvas;
- long wording wraps naturally without fixed height;
- required marker and autosave state remain visible;
- only the answer area scrolls for very large option sets; page navigation stays reachable;
- desktop testing constrains the visit canvas to a phone-like maximum width without pretending the rest of the admin app is mobile.

Type behavior:

- Yes/No: two large equal buttons that wrap labels safely.
- Single choice: vertical radio cards; 8+ options use an internal list with no visible scrollbar.
- Multiple choice: checkbox cards plus selected count; no accidental submit on option press.
- Yes/No Multi: top-level segmented choice followed by a separate scrollable multi-select branch.
- Likert: horizontally scrollable scale chips with fixed touch size; endpoint labels wrap below the scale.
- Text: growing textarea, preserved whitespace/newlines, character counter, no truncation.
- Numeric: decimal-aware numeric keyboard, min/max hint, explicit invalid-range state.
- Slider: full-width range, live value/unit, plus/minus controls for precise phone input.
- Photo: camera/gallery picker, local preview, upload progress, retry and explicit remove. Navigation cannot treat an uploading required photo as complete.
- Matrix: one row card at a time with column choices beneath it, avoiding unreadable wide tables. A compact row completion summary supports many rows and many columns.

## Navigation and review

- Sticky bottom `Zurück` / `Weiter` controls respect iPhone safe areas.
- Quick navigation opens a bottom sheet grouped by module. Each question shows current, answered, missing-required, optional, or not-applicable state.
- The quick navigator handles long module/question labels and large questionnaires with its own hidden-scrollbar list.
- `Weiter` validates the current applicable required question; quick navigation may inspect any question but final submission validates everything.
- Review shows module progress, missing answers, timer/manual duration, optional Fahrtzeit, and a submit confirmation.
- Completion shows market, timestamp, duration, and a stable submission receipt id.

## Conditional logic

- The backend re-evaluates applicability authoritatively on every save and submit; the refreshed payload updates visible phone questions immediately after autosave.
- Hidden questions become `not_applicable`; previous answers remain revision history but are not current/reportable.
- Reappearing questions restore no stale current answer automatically; the SM must confirm a new current answer.

## Verification matrix

- iPhone widths: 320, 375, 390, 430 px; portrait and short viewport.
- Question text: 1 line, 8 lines, and unbroken long tokens.
- Choice sets: 2, 12, and 30 long options.
- Yes/No Multi: both branches, 20 sub-options.
- Likert: 1–5 and 0–10 with long endpoint labels.
- Text: multiline, umlauts, emoji, 2,000+ characters.
- Numeric/slider: decimal, boundaries, invalid values, keyboard behavior.
- Matrix: 2x2, 12x8, long row and column labels.
- Photo: camera/gallery, large file rejection, retry, remove, interrupted upload.
- Logic: hide/show chains, missing required answers, restoring after reload.
- Security: foreign assignment id, completed/cancelled assignment, tampered option/cell, duplicate start/save/submit.
- Persistence: refresh after each question type and exact answer round trip.

## Delivery order

1. Add and verify the additive timing migration.
2. Implement shared runtime validation/normalization and unit tests.
3. Implement authenticated visit routes and transactional snapshot creation.
4. Add typed frontend API contracts.
5. Build start, question, navigator, review, and receipt screens.
6. Connect the SM dashboard `Starten` action.
7. Create deliberate edge-case questionnaire fixtures in a non-production test path or transaction-safe test setup.
8. Run unit/integration/build checks and visually inspect every type in the Codex browser.
9. Update `docs/sm-living-spec.md` with final routes, state machine, persistence, and verification evidence.

## Implementation checkpoint — 2026-08-24

- Steps 1–9 are implemented and audited. The additive production migrations are applied, the authenticated runtime is registered under `/sm/visits`, and the SM dashboard opens the concrete assignment.
- The start card is shown only for SM accounts with Fahrtzeiten enabled. It supports optional `hh:mm` Fahrtzeit, server-timed start, and manual visit-duration entry later. Accounts without Fahrtzeiten start directly and never receive a client-controlled SM identity.
- All ten published question types render through the production phone components. Numeric and slider questions remain unanswered until the SM explicitly interacts; a required matrix is complete only after every configured row has a selected column.
- The SM editor can configure the branch answers and branch-specific sub-options of `Ja / Nein Multi`; published answer order and allowed sub-options are validated again by the backend.
- Answer persistence is revisioned per changed question. Identical normalized answers are no-ops; branch changes invalidate only newly hidden current answers while retaining audit history.
- Private photos use the `sm-visit-photos` bucket, signed assignment-scoped uploads, server commit validation and soft-deleted file metadata.
- Browser edge fixtures are development-only at `/dev/sm-visit-preview`; production builds return `notFound()` for this route.
- Final build, focused-test, production-database, security and iPhone-width browser evidence is recorded in section 25 of `docs/sm-living-spec.md`.
