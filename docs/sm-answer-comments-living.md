# SM answer-triggered comments

## Scope and contract

- SM only. GM authoring, questionnaire UI, data and the GM Zusatzzeiterfassung
  component are unchanged. Its compact 360px comment dialog is the visual reference.
- Admin enables **Kommentar bei Antwort** and selects the answer chips that
  require a comment; **Alle Antworten** selects every answer. Switching off
  removes the trigger. A configured trigger makes the comment required, not
  optional for the employee.
- Choices (single, yes/no, yes/no multi, multiple, Likert) can target exact option
  codes. Duplicate labels still identify different options.
- Matrix triggers target columns: selecting a marked column in any row requires
  one question-level comment. Text, numeric, slider and photo support a comment
  on any nonempty answer.
- Multiple trigger options on the same question use one question-level comment.
  Yes/no multi targets the primary answer; branch selections remain ordinary
  answer data.
- Unanswered optional questions are skippable. Once an answer triggers a comment,
  it is required even if the question itself was optional. Hidden questions never
  block completion.

## Authoring and immutable configuration

- Compact **Kommentar bei Antwort** switch after type configuration, matching
  the adjacent OOS control. When enabled, vertically stacked answer chips appear without
  tabs, an accordion or a nested panel. Full labels are available in tooltips;
  accessible labels distinguish duplicate options by position. Non-choice
  questions only show a short explanation beneath the switch.
- Stored in existing SM question config JSON:
  `commentTrigger: { mode: "answered" }` or
  `commentTrigger: { mode: "options", optionCodes: ["option_4"] }`.
  Matrix uses `column_N`.
- No schema migration. Read-only schema inspection confirmed JSONB for
  `sm_question_versions.config`,
  `sm_questionnaire_submission_questions.config_snapshot`, and
  `sm_question_answers.value_json`.
- Existing version signatures include config, so saving a changed trigger creates
  the appropriate new version. Started visits retain their original snapshots.
  New visits use the newly published configuration.
- Renaming options preserves their triggers. Deletion uses the exact removed
  index, including duplicate labels; codes are remapped after blank-row filtering.
  Likert range edits preserve the selected numeric label, not the old position.
  Type changes reset incompatible config. Removing all selected trigger options
  leaves an explicit incomplete configuration which cannot be published.
- Backend authoring validates mode, nonempty selection and known option codes.

## SM questionnaire behavior

- A newly selected trigger choice opens a native modal dialog above the app.
  Background interaction is inert, focus is contained/restored, Escape/close
  return to the question. Closing never bypasses required-comment checks.
- GM-matching rounded white panel, blurred backdrop, small header and compact
  footer. Mobile textarea is 16px to avoid iOS focus zoom; desktop uses 12px.
- Maximum 2,000 characters; whitespace-only is not a valid comment.
- Free input is not interrupted while typing. Its comment opens on Next or via
  the small comment row. Photo comments open after pending uploads are committed.
- The question retains only a compact one-line comment/edit row, not an expanded
  textarea. Reopening restores text. Changing the triggering choice clears a stale
  explanation; changing unrelated multiselect choices retains the comment while
  the triggering subset stays the same.
- Next, review/progress and server submission checks all include comment
  completeness. No network wait is added to ordinary choice navigation.

## Persistence, offline, and safety

- Comments are an optional bounded `comment` property of the existing typed SM
  answer payload. Base answer kinds/option values are unchanged.
- Drafts may save the triggering answer without a completed comment; submission
  cannot. Comments use the existing ownership checks, version conflicts, audited
  answer writes and offline pending-answer queue. Reload/resume preserves them.
- Normalization trims comments and discards comments for non-trigger answers.
  Rules and OOS calculations continue consuming the base answer only.
- Photo comments are a guarded comment-only update to the existing photo answer:
  submitted file IDs must exactly match its existing active files. No file
  creation, deletion, reassignment or copy is possible through this operation.
  The answer version increments and the audit event captures before/after.
- Upload/remove operations retain existing comments while photos remain, clear
  the comment when the last photo disappears, and synchronize a pending comment
  before changing the photo set. Offline comment queue replay includes photos.
- SM activities display the saved comment; correction requests can edit it and
  cannot introduce a trigger answer without its required explanation. Existing
  request summaries/audit snapshots include the comment.
- No production records were created, edited or deleted for this implementation
  or verification. No GM code or data change. Release requires no DB migration;
  deploy the backward-compatible backend before the frontend.

## Verification and local review

- Backend TypeScript build passed.
- 25 focused frontend/backend comment + existing answer tests passed.
- 34 backend comment/answer/OOS regression tests passed.
- Focused frontend TypeScript check passed. Repository-wide tsc still reports
  unrelated existing backend test fixture/type errors.
- Browser verified actual shared components on desktop and at 390px phone width:
  exact option trigger, required empty state, enter/save/reopen, Escape, Next,
  and changing to a non-trigger answer. Removing an earlier option preserves
  the selected trigger and still opens the comment for the same answer label.
- Admin UI refinement verified: enabled/disabled switch, individual chips,
  select-all, deselecting one answer after select-all, and the empty-selection
  hint. Desktop and 390px layouts checked; questionnaire dialog and persistence
  logic were not changed by this visual refinement.
- `http://localhost:3000/dev/sm-answer-comments` is a development-only,
  no-database sandbox using the real admin trigger editor and SM question card.
- Normal app: `http://localhost:3000`; local API: port 4000, started through
  a local launcher without GM/production background schedulers.
- Production persistence was not exercised with real employee submissions.
  Normal live-data review should use a newly started SM visit, not an older
  immutable questionnaire draft.
