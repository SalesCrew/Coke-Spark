# Boni UI verification — living record

Updated: 2026-10-02. Final browser run started at 2026-10-02T09:26:01.087Z.
Status: isolated release checks passed; production deployment authorized by the user on 2026-10-02 and being published. Earlier no-push statements below record completed local review stages.

## Isolation

The preview runs on frontend 3017 and backend 4017 with in-memory PGlite and synthetic accounts, questions and visits. Its source copy contains zero `.env*` files. The launcher supplies a clean environment whitelist and local synthetic Supabase placeholders; the fixture rejects production/database configuration. It imports neither the application entry point nor schedulers/env/database clients. Browser CSP limits connections to the isolated local services. No production connection or production data was used for testing or verification. The normal user-facing local servers on 3000/4000 remain separate.

Runtime source copy: `/var/folders/ks/0mhtl2s17ln9fcg3s9_cjxdm0000gn/T/coke-boni-ui-fqy1xa4q`.
All Boni runtime files and the backend template/fixture were compared byte-for-byte with the managed worktree.
Launcher: `/tmp/coke-boni-preview-launcher.mjs`; it reads the isolated copy path from `/tmp/coke-boni-preview-path.txt`.

## Actual results

| Check | Result | Evidence |
| --- | --- | --- |
| Unit and real-router integration | 10/10 passed, exit 0 | Listed test command; disposable PGlite migrations, synthetic visits and HTTP saves |
| Full browser flow | 56/56 passed, exit 0 | `checks.json` has `complete: true`; full checklist below |
| Frontend TypeScript | Passed, exit 0 | `tsc --noEmit` in the isolated source copy |
| Backend TypeScript build | Passed, exit 0 | `tsc -p tsconfig.build.json` |
| Scoped accessibility | 0 violations on page and expanded question editor | `a11y-page.json`, `a11y-editor.json` |
| Browser runtime errors | 0 | `runtime-errors.json`, checked as structured errors array |
| Visual review | Desktop 1440×1000, tablet 1024×900, mobile 390×844 | 19 PNG artifacts; overview, questions, tiers, rules, history, dialogs, archive/loading/errors |
| Source hygiene | Both diff checks passed | `git diff --check` in frontend and backend; no environment values added |

## Commands

The tests do not load production env files. Node runtime used:
`/Users/kiliansternath/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`.

From the managed frontend worktree:

```sh
node backend/node_modules/tsx/dist/cli.mjs --test \
  tests/praemien-question-selection.test.ts \
  backend/src/praemien-ui-model.test.ts \
  backend/src/praemien-workspace.integration.test.ts \
  backend/src/praemien-many-sources.integration.test.ts
```

From the isolated source copy:

```sh
node node_modules/typescript/bin/tsc --noEmit
```

From the backend worktree:

```sh
node node_modules/typescript/bin/tsc -p tsconfig.build.json
```

Browser runner: `tests/praemien-ui-browser.mjs`, with `AGENT_BROWSER_CLI` pointing to the installed CLI, `AGENT_BROWSER_EXECUTABLE` pointing to installed Chromium, and `BONI_UI_EVIDENCE_DIR` set to the artifact directory below. The runner hardcodes 3017/4017 and checks `fixture-info` before any synthetic mutation. Start it against a freshly started fixture. The preview backend starts via `node /tmp/coke-boni-preview-launcher.mjs backend`; the frontend uses the same launcher without `backend`. Use the explicit Node runtime above when Node is not on PATH.

## Model/source audit

- Directly viewed the saved Q1 PDF page 10: each new qualifying placement gives one point; component minimums are 18 placement points and 5 cooler points. The combined tiers are 22/26 points. Corrected only the Q1 template's invented placement conversion; existing saved models are not rewritten.
- Read only Q2 workbook rule cell `Flexziel - Kühler+RED!H2`: +2/+3 net coolers give 5/10 points; RED 80/85% gives 5/10 points; both components must reach 5 points, with combined 10/15-point payout tiers. Negative net cooler input is supported and tested.
- The grouped quality calculation takes the highest tier per group, then sums/caps. Existing tests verify no double payment, missing versus explicit zero, total limits, units, legacy totals, frozen revisions and conflict guards.
- No verified Q3 payout rates or complete quality scoring definition was supplied. Those remain explicit administrator configuration; no new rates were invented.
- Original attachments are no longer present; cached renders and cell extracts are the available source evidence. Historical employee values were not reused as fixtures.

## Important calculation evidence

80 question sources and two synthetic visits per question produce 80 points, with 80 repeated observations excluded. Changing a weight in preview changes the preview payout but leaves the stored model, revision and reward untouched.

The browser saved 81 assignments and reopened decimal factor `3,5`, frequency 8, chain filters, Flex section, once-per-market counting and Ja selection. Preview and cancellation did not mutate the saved model. Availability keeps its existing one-product-per-metric constraint; multiple product quotes can be combined through the existing average method.

The browser independently selected `coolers` and `racks`, each at a 50% threshold. A 100/49.99 input yields €0; 100/50 yields €82.50. Unit tests cover the opposite failing target, both exact boundaries and missing inputs.

## Issues found and corrected

- Delayed initial dropdown focus could override a rapid Home/End selection. Focus now happens in a layout effect and only the option list scrolls.
- Faint text, nested main landmarks and inactive popup references were corrected. Gradient button contrast was checked manually: white primary text is at least 4.83:1; secondary control text at least 9.45:1; muted page text at least 4.57:1.
- Blank required decimal fields now fail validation. Numeric errors stay above the scrolling form and focus the invalid input.
- Catalog errors stay visible with a retry button, preserving unsaved assignments. Failure/recovery tests assert actual viewport visibility, not merely existence in the DOM.
- The synthetic sidebar preference endpoint now uses memory-only responses, preventing unrelated preview runtime errors.
- Test harness uses stable question identity, scoped payout fields, viewport screenshots inside dialogs, keyboard deletion for empty numeric values, actual download refs and structured runtime-error output.

## Completed browser checklist

- [x] normal Boni page with four original pillars
- [x] page accessibility audit has zero violations
- [x] 80 questions assigned in a bounded scroll list
- [x] individual assignment toggles with keyboard
- [x] Escape closes dropdown and keeps editor/focus
- [x] question editor accessibility audit has zero violations
- [x] empty search keeps all assigned questions
- [x] question eligibility/type filter
- [x] preview leaves rules and revision untouched
- [x] 81 sources and detailed settings persist
- [x] saved question settings reopen
- [x] availability limits assignment to one product
- [x] question already owned by another metric excluded
- [x] copy preserves rules and excludes employee values
- [x] AND adds independently selected second target
- [x] condition metric is selectable with keyboard
- [x] End selects the second target without closing the popup early
- [x] AND rule persists with separate keys and thresholds
- [x] one target below 50 blocks UI payout
- [x] both targets at 50 permit UI payout
- [x] invalid numbers block preview with visible feedback
- [x] rules summary shows the combined payout requirement
- [x] history records rule and employee edits
- [x] Excel export includes actual synthetic employee and metric rows
- [x] wave activation works
- [x] active rules require preview before save
- [x] archived wave freezes model and results
- [x] cumulative leaderboard includes archived results
- [x] tablet page has no horizontal overflow
- [x] tablet question list retains 80 selections
- [x] tablet dropdown contained in viewport
- [x] tablet modal traps keyboard focus
- [x] tablet reverse focus wraps to footer
- [x] mobile page has no horizontal overflow
- [x] mobile question list retains 80 selections
- [x] mobile dropdown contained in viewport
- [x] mobile modal traps keyboard focus
- [x] mobile reverse focus wraps to footer
- [x] bulk assignment respects the 100-source limit
- [x] expanded question supports a second assignment without exceeding the limit
- [x] blank required numbers block model preview with feedback
- [x] model validation feedback stays visible above the scrolling form
- [x] cancelled source edits leave saved model and revision untouched
- [x] long wave dropdown has searchable empty feedback
- [x] long dropdown search and keyboard selection work
- [x] unassigned question list explains its empty state
- [x] Tab closes dropdown and advances to the next control
- [x] question loading state is visible without dropping assignments
- [x] catalog failure preserves assigned sources and explains the error
- [x] catalog error and retry control remain in view
- [x] catalog retry recovers without closing the editor or dropping assignments
- [x] wave read failure has visible retry feedback
- [x] wave loading status is visible during retry
- [x] wave reload recovers without changing saved data
- [x] UI rendered without error alerts
- [x] no browser runtime errors

## Artifacts and local handoff

Artifact directory: `/Users/kiliansternath/Documents/Codex/2026-10-01/i-my-gmail-i-just-sent/outputs/chat-results/01a0f7df-8ecd-7e13-a775-234622c5fc5d/boni-ui-redesign-2026-10-02`.

- `checks.json`: completed manifest and isolation metadata.
- `a11y-page.json`, `a11y-editor.json`, `runtime-errors.json`.
- `question-picker-desktop.png`, `question-settings-desktop.png`, `and-editor-desktop.png`.
- `overview-desktop.png`, `overview-tablet.png`, `overview-mobile.png`, `questions-tablet.png`, `questions-mobile.png`.
- `rules-desktop.png`, `history-desktop.png`, `employee-preview.png`, `new-wave-dialog.png`, `archived-desktop.png`.
- `empty-configuration-desktop.png`, `invalid-number-feedback.png`, `question-loading.png`, `question-load-error.png`, `wave-loading.png`, `wave-load-error.png`.
- `boni-synthetic-export.xlsx`: actual downloaded export; verified Prämien/Messwerte sheets and synthetic GM rows.

Preview: http://localhost:3017/dev/praemien-fixture. Click “Boni-Vorschau öffnen”. “Boni UI Kopie” demonstrates 81 saved assignments; “Boni UI UND” demonstrates independent 50% targets and synthetic saved values. The disposable blank waves used for long-dropdown checks are older, so the initial preview presents the complete four-pillar model.

## Scope and limitations

The required local redesign and synthetic verification are complete. No push, deployment, production smoke test or production data change occurred. Actual production data and real-account behavior were deliberately excluded from verification. This is a local development preview, not a production build/deployment claim. Stopping the fixture discards its synthetic in-memory data.

## Follow-up verification — independent goals and Kühler/X-Mas (2026-10-02)

The preceding 56-check browser run belongs to the earlier UI scope. The updated broader browser script is retained but was not rerun for this follow-up; do not cite that count as new-scope coverage.

Current checks:

- 24/24 unit and PGlite integration tests passed: `tests/praemien-goals.test.ts`, `tests/praemien-question-selection.test.ts`, `backend/src/praemien-xmas.test.ts`, `backend/src/praemien-ui-model.test.ts`, `backend/src/praemien-workspace.integration.test.ts`, `backend/src/praemien-many-sources.integration.test.ts`, `tests/gm-dashboard-contracts.test.mjs`. Run with the bundled Node and backend `tsx --test`; these modules never load production configuration.
- Backend `tsc -p tsconfig.build.json --noEmit` passed. Frontend `tsc --noEmit` passed in the env-free isolated source copy. A broader backend check that also includes unrelated repository tests reports existing errors in untouched test files; the application-source build check is clean.
- Frontend/backend `git diff --check` passed. All ten changed runtime source files match the isolated preview byte-for-byte. Zero `.env*` files in preview frontend/backend roots.
- Browser controls were exercised through CUA on 3017 only, against the synthetic 4017 real router and in-memory PostgreSQL. No production browser route or backend connection was used for verification.

Observed browser flows:

1. Create new Kühler/X-Mas wave from the new template; four bonus types and manual quality maxima shown correctly.
2. Fill net-zero cooler inputs and all placement categories explicitly, X-Mas 20; review open → Flex €0/open. Confirm review → €82.50. X-Mas 25 with cooler 5 → €165.
3. Quality entered as Reporting €55, Survey €0, Time €110 → €165; displays 95% → €550 and distribution 90% → €165. Actual synthetic save recalculated total €1,045.
4. Create an empty independent AND model. Set goal A, create another goal via AND, focus automatically moves to the new name. Rename goal B; both minimum dropdowns read 50%. Save retains distinct keys.
5. Employee A=100%, B=49.99% → €0; A=50%, B=50% → configured €82.50.

New evidence directory:
`/Users/kiliansternath/Documents/Codex/2026-10-01/i-my-gmail-i-just-sent/outputs/chat-results/01a0f7df-8ecd-7e13-a775-234622c5fc5d/boni-xmas-2026-10-02`

Screenshots: `independent-goals.jpg`, `and-payout.jpg`, `both-fifty-payout.jpg`. The initial `reviewed-payout.jpg` captured the placement entry position, so it is not payout-summary evidence.

Isolation and practical limits:

- 3000/4000 normal human production-view servers left alone. Only disposable 4017 preview was restarted to load changed code. Preview seed contains synthetic net-zero/positive/negative scenarios and resets on restart.
- Eight-week stay, branch-closure exclusions and Execution Manager/email reporting are explicit reviewer inputs/confirmation; no external-system verification or automatic date proof is claimed.
- Quality thresholds remain unspecified; manual reviewed Euro amounts avoid inferring payout rules from 25/25/50 percentage shares.
- No existing production wave/model or production data was edited; no migration, push or deployment occurred.

Final editor check: the raw calculation settings are collapsed for multi-metric bonuses, keeping named goals and payout minimums prominent. Frontend typecheck and whitespace check passed after this markup refinement. `xmas-rule-final.jpg` shows the actual Kühler and X-Mas 50% minimum controls.

## Release preflight — Boni and four GM Dashboard items (2026-10-02)

- Copied the current source to a new disposable directory with `.env*`, Git state, build output and dependency directories excluded. Dependencies were linked separately. A whitelist child environment supplied local synthetic endpoints and placeholders; no production settings were loaded.
- 63/63 checks passed (0 failures/skips): all frontend `gm-dashboard-*.test.ts`/`.tsx` and contract checks, backend `gm-dashboard*.test.ts`, Boni goal/question-selection checks, and backend Xmas/UI-model/workspace/many-sources checks. PostgreSQL integration cases use in-memory PGlite only.
- Backend production build (`tsc -p tsconfig.build.json`) passed. Frontend optimized production build (`next build --webpack`) passed, including TypeScript and prerendering. The dev Boni fixture is unavailable in production via its explicit environment guard.
- RED cases cover latest explicit Ja, Nein, missing answers, string/object/top-option storage, sub-options, invalid answers and excluded visits. Query fixtures were compared before/after to verify read-only behavior.
- Competitor cases retain separate cooler/large-placement questions, historical question labels, configured signed points, latest eligible market answers and chain filters. Frontend component cases cover real detail rows and empty/loading states.
- Availability shortcut cases cover REWE/SPAR together and individually editable constituent chains. Existing original-card layout, chain/market unions, historical date ranges, chart gaps and signed points remain covered.
- Deployment confirmation uses Vercel/Railway metadata for exact commit, production target, readiness and alias. Production application/database smoke tests are excluded. No data migrations or existing wave/model changes are authorized.
