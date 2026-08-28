# SM Fragebogen Excel export — LivingMD

Status: implemented and verified 2026-08-27
Started: 2026-08-27
Scope: `/admin/sm/fragebogen` authoring-catalog export only; no GM database mutation

## Update rule

This file records the observed GM export behavior, the deliberate SM differences, the shipped workbook contract, and the verification evidence. The feature is not considered complete merely because the Excel button downloads a file. The workbook must reopen successfully, contain every required relationship, and reflect only the loaded SM workspace.

## Evidence inspected

- GM UI event and loading/error behavior in `src/app/admin/fragebogen/page.tsx`.
- GM workbook implementation `exportFragebogenExcel` in `src/lib/exports/planningExports.ts`.
- Shared Coke Spark workbook styling in `src/lib/exports/workbook.ts`.
- SM current workspace loader and authoring UI in `src/components/admin/sm/SmFragebogenWorkspace.tsx`.
- SM authoring DTOs in `src/types/smQuestionnaire.ts`.
- SM persistence and differential versioning in `backend/src/routes/sm-questionnaires.ts`.
- SM schema/migrations `0089_sm_questionnaire_domain.sql`, `0090_sm_questionnaire_fk_indexes.sql`, and `0091_sm_enforce_soft_deletes.sql`.

## What the GM side actually exports

The GM export is a client-side, styled `.xlsx` snapshot of the already loaded authoring workspace. It does not query or mutate the GM database during export.

The GM flow:

1. the shared admin header dispatches `admin:fragebogen:export`;
2. the page prevents concurrent exports and clears the previous error;
3. the current module/questionnaire state plus the authenticated exporter identity is passed to the exporter;
4. the exporter creates a multi-sheet workbook using the shared Coke Spark workbook helpers;
5. every table sheet has a title, description, dark header, autofilter, frozen header rows, column widths, and typed cells;
6. the workbook contains metadata, questions, modules, questionnaire rows, questionnaire-module order, questionnaire-specific questions, and control totals;
7. the browser downloads a date-stamped filename;
8. an exception is shown in the page instead of silently producing a partial workbook.

The important design principle is relational completeness: question rows alone are not enough. The export also preserves module membership, questionnaire composition/order, configuration, and control totals so the workbook can be audited.

## SM differences

SM reuses the GM workbook structure and styling, but it must not carry over GM-only concepts that do not exist in the SM authoring domain:

- no GM campaign scope;
- no GM section scope (`standard`, `flex`, `billa`, `kuehler`, `mhd`, `durcharbeit`);
- no GM Spezialfragen sheet;
- no GM RED-Survey, chain applicability, availability scoring, campaign usage, or GM photo-tag fields.

SM adds the configuration that is necessary to reconstruct and audit an SM questionnaire:

- all ten SM question types;
- required/optional state;
- answer options and Ja/Nein-Multi branch options;
- matrix rows/columns;
- complete configuration JSON for type-specific settings;
- conditional show/hide rules and target question IDs;
- OOS detection/remediation role, category, linked detection question, answer outcome mapping, and partial-remediation rule;
- questionnaire status, version, `nurEinmalAusfuellbar`, exact module order, and question counts.

## Workbook contract

The implemented filename is `CokeSpark_SM_Fragebogen_YYYY-MM-DD.xlsx`.

Sheets:

1. `Meta` — export identity, time, counts, and scope note.
2. `Fragen` — one row per current question in a current module.
3. `Module` — reusable module metadata and usage count.
4. `Fragebogen` — current questionnaire metadata, version, module/question counts, and one-time rule.
5. `Fragebogen Module` — exact ordered relation between questionnaire and module.
6. `Logikregeln` — one row per conditional rule including operator, value, action, and target IDs.
7. `OOS Zuordnung` — one row per OOS-enabled question and its SM dashboard mapping.
8. `Summen` — control totals by question type, required state, questionnaire status, and OOS category.

## Invariants

1. Export is read-only and never calls an authoring mutation endpoint.
2. Export uses only the SM workspace currently returned by `/admin/sm-questionnaires/workspace`.
3. Missing module references remain visible as an explicit `Fehlende Modulreferenz` row; they are not silently dropped.
4. IDs are exported alongside names so duplicate labels remain distinguishable.
5. Type-specific configuration is represented both in readable summary columns and the complete JSON column.
6. Workbook serialization must round-trip through `xlsx-js-style` without losing sheet structure.
7. The implementation does not import, query, update, or delete any GM table.

## Implementation record

- 2026-08-27: added `src/lib/exports/smQuestionnaireExport.ts` with the eight-sheet SM workbook.
- 2026-08-27: replaced the SM UI-preview handler with the real asynchronous export and visible success/error state.
- 2026-08-27: added a workbook contract test covering sheet order, SM question type, required state, branch options, OOS outcome mapping, questionnaire-module version data, and serialization round-trip.

## Verification matrix

| Scenario | Expected | Evidence |
| --- | --- | --- |
| Empty SM workspace | Eight valid sheets with headers/control metadata | Passed in `smQuestionnaireExport.test.ts` |
| Mixed SM question types | Every question exported with the correct readable type | Passed for all ten SM types; ten distinct readable labels |
| Ja/Nein Multi | Top answers and branch options exported | Passed; branch option survives the readable export |
| Matrix | Rows/columns and full config exported | Passed; readable matrix summary and complete Config JSON are present |
| Conditional rules | Trigger/operator/value/action/targets exported | Passed in the relational workbook contract test |
| OOS mapping | Role/category/link/outcomes exported | Passed for detection role and answer outcomes |
| Workbook reopen | Serialized workbook reopens with identical sheet order | Passed through `xlsx-js-style` write/read round-trip |
| GM isolation | No GM API/database mutation in export path | Static import/call audit complete; export reads only the loaded SM DTOs |

Final gates on 2026-08-27: frontend production build passed, backend TypeScript build passed, and all three focused workbook tests passed. The implementation does not issue a database request during export.
