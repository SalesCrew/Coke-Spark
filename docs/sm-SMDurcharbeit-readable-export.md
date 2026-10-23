# SM Durcharbeit answer export — 2026-10-19

## Output

The campaign/month results export starts with **Einsätze**, using the GM layout principle: one actual visit per row, identifying market/SM/time columns first, followed by a value and comment column for each recorded question. Numbers remain numeric, including zero. Postal codes remain text. Formula-like answer text stays literal text.

Answers use immutable submission snapshots rather than the current authoring catalog. All ten SM question types are supported: original option labels, multiple selections, Ja/Nein sub-options, text, numbers/sliders, matrix row/column labels and authorized photo counts. Compatible revisions of the same stable question share one answer/comment column pair. Different question identities or incompatible wording, types or answer meanings remain separate, even when their titles match. A question absent from a visit's version stays blank; an applicable unanswered question says Nicht beantwortet; hidden/inapplicable questions say Nicht anwendbar without exposing old hidden answers/comments.

The existing six audit/summary sheets remain. Letzte Antworten gains a readable answer, comment and market column while retaining raw JSON, IDs and provenance. Monthly coverage and distributions continue to count the latest valid submission per required market. Einsätze includes earlier/follow-up physical visits separately. Invalidated or withdrawn submissions retain their time row and explicit invalid status, with no answer contents.

Every cell in the used range has an explicit light background, including otherwise blank cells, so spreadsheet dark themes cannot turn the data table black. The dark column headers and pale metadata labels retain their existing intentional colors.

## UI and API

- SM → Durcharbeit Verplanung → campaign → selected month → Monatsauswertung → **Antworten exportieren**.
- The click fetches a fresh result using `includeVisitAnswers=true`, preserving the selected month and SM scope. Stale account/filter/month/unmount results cannot trigger a download.
- The normal report request does not fetch the full visit-answer history. The opt-in request uses the existing read-only repeatable-read transaction and existing admin/customer read permissions.
- Answer queries batch at 1,000 submission IDs, cap at 200,000 question rows, preserve canonical photo withdrawal checks and never query once per market. XLSX dimensions and cell count are bounded before serialization.
- The unrelated authoring download on SM → Durcharbeit is now labeled **Fragenkatalog exportieren**, with a matching Durcharbeit_Fragenkatalog filename. It continues to export configuration, not submissions.

No schema migration, backfill, answer rewrite, import or campaign status change is required. No production business-data verification is permitted. When releasing, deploy the additive backend query support before the frontend; an old backend will reject the new explicit query parameter rather than produce an incomplete export.

## Verification

`test:sm-durcharbeit-export` covers workbook serialization/reopen and the real disposable route flow from original submission through questionnaire adoption and follow-up to the XLSX. It checks history snapshots, unchanged monthly counts, individual visit times, option labels, matrix indexes, numeric zero, comments, formula-like text, version separation, absent/hidden/unanswered questions, empty filters, campaign/month/SM scoping, customer permissions, photo withdrawal, invalidation and byte-for-byte preservation of the original business graphs across reads/exports.

Additional regression: existing pause and photo withdrawal suites. All testing uses disposable synthetic data with no production environment files. Admin browser verification uses a laptop viewport on 3037/4037; 3000/4000 remains the human app.

Verified: 11 focused checks passed; the overlapping report/export/pause/photo regression run passed all 16 checks. Backend TypeScript build, final optimized frontend build and scoped lint passed. The real 1440×900 browser download was captured and reopened: Einsätze is the first sheet, the market/SM/time match the fixture, and the answer cells contain Ja, Original note and 1 Foto rather than technical JSON. The renamed authoring download also completes with the Durcharbeit_Fragenkatalog filename. No production data or schema changes are part of this implementation.

## Compatible question revisions — 2026-10-23

The readable Einsätze sheet groups revisions by the stable question code, normalized wording, question type and frozen answer meaning. Simple yes/no, single-choice and multiple-choice questions use their original answer labels; changes to photo/comment requirements, scoring or technical option codes do not create another business column. Other question types also require matching frozen configuration, including matrix axes and numeric units. Independent questions are never merged by title alone.

Each visit still has its own row and answers are decoded using that visit's original snapshot. Missing, unanswered and hidden observations never become a fabricated Nein or numeric zero. Numeric zero remains numeric. Original comment text is retained; distinct comments on matching values are combined without discarding either comment.

When compatible revisions within one visit contain different saved answers, the answer cell displays Widersprüchlich with all observed values. Its comment cell associates each value with its comment, and a conditional Prüfhinweise column identifies the affected questions. No answer is chosen automatically. The diagnostic header cannot collide with an authored question title. Duplicate copies of the exact same visit/question revision still abort export instead of silently replacing data.

The existing audit sheets, raw JSON, question-version identities, monthly distributions, visit times, photo access and report counts retain their existing contracts. Meta explains the readable column grouping and conflict handling. This is a frontend-only release with the existing backend/API and database schema; no migration, backfill, historical correction or production business-data access is performed.

Verification: all 14 checks in the complete SM Durcharbeit export command pass against synthetic data. The actual disposable authoring → revised question → campaign adoption → follow-up → report → serialized/reopened XLSX flow confirms that a validation-only edit produces two distinct question-version IDs and one readable question column. Synthetic workbook cases cover three revised questions, same-visit conflicting answers/comments, absent versus hidden answers, numeric zero, incompatible definitions, independent stable identities, header collisions and unchanged source payloads. Existing history/photo-withdrawal, customer permissions and monthly-count checks pass. The optimized frontend build with TypeScript and scoped Next/TypeScript lint pass with an empty, explicitly controlled environment. Production-connected localhost and production data are not used for verification.
