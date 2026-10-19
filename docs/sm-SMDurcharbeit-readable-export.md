# SM Durcharbeit answer export — 2026-10-19

## Output

The campaign/month results export starts with **Einsätze**, using the GM layout principle: one actual visit per row, identifying market/SM/time columns first, followed by a value and comment column for each recorded question. Numbers remain numeric, including zero. Postal codes remain text. Formula-like answer text stays literal text.

Answers use immutable submission snapshots rather than the current authoring catalog. All ten SM question types are supported: original option labels, multiple selections, Ja/Nein sub-options, text, numbers/sliders, matrix row/column labels and authorized photo counts. Distinct question versions have distinct columns, even when their labels match. A question absent from a visit's version stays blank; an applicable unanswered question says Nicht beantwortet; hidden/inapplicable questions say Nicht anwendbar without exposing old hidden answers/comments.

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
