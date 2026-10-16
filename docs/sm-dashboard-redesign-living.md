# SM admin dashboard — upper overview and reporting implementation

Date: 2026-10-16. Status: implemented and verified locally; no push or production changes.

Requirements: [canonical metric definitions](sm-dashboard-metrics-spec.md). Current goal: plan and build the upper UI first, review its composition, then implement all twelve metric calculations and Basistätigkeiten authoring/reporting. Preserve existing lower category/chain/region bar-chart UI. No production queries, writes, migrations, tests or deployments.

## UI diagnosis and decisions

The existing five cards mix visit counts, market prevalence, case frequency and documentation coverage at equal visual weight. Each repeats an icon, colored top edge and progress track, including for counts without a meaningful percentage denominator. Activity and outcome are difficult to scan separately.

Use existing white surfaces, muted grey borders, 12px panel radii, font and red/green data colors. Preserve the existing compact filter row. Keep the lower JSX, RateCell, DimensionTable and corresponding style rules unchanged.

1. **Besuchsübersicht:** one full-width card. Four equal base columns: Besuchte Märkte, Marktbesuche, Leistungsstunden, Merchandiser. Two quieter averages below a divider: Besuche / Markt and Stunden / Besuch. No icons, category badges or progress indicators for these counts.
2. **Leistung im Markt:** one clearly separate performance panel, six generous cells in a three-column/two-row grid. First row: Basistätigkeiten, Märkte mit OOS, Häufigkeit vorgefundener OOS. Second row: Behebungsquote, Steigerung der Warenverfügbarkeit, Warenverfügbarkeit nach OOS-Behebung. This follows work completed → detection → remediation and makes calculated values dominant.
3. Use a larger value, a sentence-case label and a short denominator/explanation. Color comes from meaning: neutral frequency, red found OOS, green work/remediation/recovered availability. No decorative top borders or duplicate progress tracks in the new upper area.
4. Steigerung includes a small before→after explanation, with +% explicitly meaning the recovered share of all category observations. Its main value is the paper's absolute gain, never relative growth.
5. At laptop widths 1280–1600 retain four activity columns and three performance columns. Narrow laptop windows may reflow performance to two columns; verify labels, zero states and long values. No admin phone testing.
6. Keep data sources separate from presentation through one typed overview payload. No demo values in the production component. Missing values show an honest unavailable state with context.

## Behavior and evidence required

- One filtered cohort for all counts, ZE duration and answer outcomes, with historical visitors retained. Unvisited directory entries do not become visited markets.
- Published question config / submitted answer snapshots preserve Ja/Teilweise/Nein metadata independent of answer wording. All question types support explicit mapping. No historical backfill or answer rewrite.
- Cumulative OOS cases deduplicate at visit×category; partial remediation counts fully in the new upper KPI. Existing lower chart calculations/UI must retain their established contract.
- Empty and incomplete data must not produce invented success percentages or substitute planned time. Loading, error and refresh states remain aligned; prevent stale filtered exports.
- Verification: disposable fixture with real authoring/answer/submit routes, pure edge/matrix tests, export matching, laptop screenshots, final visual self-review and scoped build/type/lint checks.

## Progress

- Read deslopify and current dashboard/editor/reporting sources. Existing human 3000/4000 left untouched; independent synthetic preview started on 3037/4037.
- UI plan recorded before logic changes. Baseline upper and lower sections identified for comparison.


## Implemented data path

Authoring JSON `question.config.basicActivity` → immutable published version → submission config snapshot → server-derived answer `metric_outcome_code` → filtered applicable current answer read → pure `aggregateSmDashboardOverview` → typed dashboard overview → UI and export. Existing answer metadata and JSON storage suffice, so no migration is required. No historical answer is relabeled or backfilled.

All ten question types are covered. Choice/multi/yes-no/Likert use explicit option mappings, matrix uses column mappings, text has exact-value rules, numeric/slider have inclusive non-overlapping ranges, and photo uses a committed-photo mapping. Explicit fallback bindings are available for non-choice values. Conflicting mapped selections use the lowest credit once per question; raw values and OOS metadata remain independent. New metadata is also stamped on approved employee changes, admin corrections, photo changes and monthly carry-over using frozen config.

The new upper OOS calculations use visit×category observations and count partial remediation fully. Existing lower category/chain/region chart JSX and legacy aggregation are retained. A separate upper aggregator avoids changing phone behavior. The phone route does not load the admin basic-task query or ZE joins.

Actual ZE is loaded from its accepted current revision, without travel or planned-time substitutes. A partial time total includes coverage; the per-visit time average stays unavailable until complete. All dashboard data reads share a repeatable-read read-only transaction and the same filters. Exports contain all twelve values with units and denominators and cannot export old filter results while pending/failed.

## Visual review and refinement

- First rendered composition separated six activity figures into a quieter card and six outcomes into a 3×2 performance panel. Retained the product's typography, white surfaces, muted separators, established red/green meaning and custom filter controls.
- Critique: the gain explanation was abstract and the old “OOS Dashboard” title understated activity coverage. Replaced it with “Besuche & Marktleistung” and show the concrete recovered numerator/total alongside the gain. Before→after remains subordinate to after availability. No relative-growth label is used.
- Inspected 1280×800, 1440×950 and 1600×950 laptop layouts. Filter controls stay on one row, Market stays widest, labels fit, no horizontal document overflow. No admin phone checks were performed.
- Browser proof covered region filtering, unvisited-market zero/unavailable state, real Excel download, existing-module editing, semantic mapping save/reopen, and custom dropdown ArrowDown/Enter selection. Added a label to the new mapping toggle and listbox/option semantics, Escape/Tab dismissal and focus return to the reused custom dropdown.
- Initial loading mirrors the new UI. During filter changes the upper values load and the status says the results are updating; old filtered values cannot be exported. Errors retain the established retry action.

## Verification evidence

- Frontend production build, frontend type check, backend production build type check and scoped Next/TypeScript ESLint pass. The repository has no checked-in ESLint config and its legacy `next lint` script is incompatible with Next 16; scoped lint used a temporary config importing the installed Next core-web-vitals and TypeScript configs. No lint infrastructure was committed.
- Nine frontend filter/skeleton tests pass, including preservation of the lower loading bar-chart layout.
- The final focused backend suite passes **72 tests**; the real all-type workflow includes its added admin-correction/employee-approval metadata case. It verifies authoring, submission, photo removal/recommit, actual ZE revisions, filter/date scopes, invalid mapping rejection, frozen mapping history and unchanged raw answers.
- Pure calculation tests include the full paper cohort (852 visits, 135 markets, 3408 checks, 599 found, 457 fixed → +13.4%), repeat visits, duplicate options/questions, partial fixes, missing ZE, empty data and valid-check coverage. Existing lower OOS and employee-home tests pass.
- Browser-downloaded Nord workbook reconciled to the displayed 2 visits / 2 markets / 1 hour / 1 SM / 75% basic tasks / 2 found categories / 50% remediation / +12.5% gain / 87.5% after. All twelve rows, raw denominators and numeric percentage formats match.
- A broader monthly regression suite has one pre-existing failure (plus its parent test): `SMDurcharbeit-monthly.integration.test.ts:281`, weekly profile expects assignmentCount 1 but gets 0. Reproduced identically in an untouched backend HEAD export at `9a4dc78` with a fresh disposable database. This task does not change the profile/weekly logic or that assertion. Other monthly visit/photo/carry-over checks pass. The limitation is recorded rather than claiming a completely green unrelated suite.
- Only disposable databases and synthetic storage were used. No environment values, production records or production connections were used for tests or verification. No deployment or push performed.

## Review runtime and boundaries

Agent review uses an isolated production-mode frontend source snapshot and synthetic backend on **3037/4037**, with `NEXT_PUBLIC_BACKEND_URL` explicitly set to 4037 at build time. Synthetic sign-in is `sm-admin@preview.test` / `preview`. This does not alter the human production-connected app on 3000/4000.

There are unrelated pending Durcharbeit transfer edits in the shared worktree. They were not authored, reverted or staged by this dashboard task; the frontend review snapshot contains the dashboard/editor task files and previously pending dashboard filters only. No commits or pushes were made.


Final completion audit: all six activity and six outcome KPIs are wired, explicit Basistätigkeiten mapping works across all ten types and correction paths, D5 matches the supplied paper, filters/exports align, and existing lower charts remain intact. 72 focused backend tests plus 9 frontend tests pass (81 total); the affected metadata unit/real-route checks passed again after tightening explicit-key lookup. Frontend review snapshot builds and runs in production mode, scoped lint passes, and backend build type check passes. Final browser reload confirmed the disposable backend response renders in that production-mode frontend. Saved screenshot: `outputs/sm-dashboard-2026-10-16/dashboard-final-1440.png`. Frontend source snapshot: `/var/folders/ks/0mhtl2s17ln9fcg3s9_cjxdm0000gn/T/coke-sm-dashboard-review-a4s3t2qp`. Review processes left running on 3037 and 4037; browser viewport override reset. The separately reproduced baseline weekly-profile failure remains outside this completed dashboard scope.


## Human localhost handoff — 2026-10-16, 11:36 Europe/Vienna

After completing isolated verification, Kilian explicitly requested the changes in the normal production-connected local app. The existing human frontend is a separate source copy under project-context/Coke Spark/runtime/human-app/frontend. Synchronized the seven changed/new dashboard/editor files after checking their bytes against the verified frontend review snapshot; the two type files already matched. Before-images and SHA-256 manifest are retained under human-app/backups/sm-dashboard-20261016-113622. Other frontend work, environment files and launchers were preserved.

Restarted the existing human launchers: frontend localhost:3000 and backend localhost:4000. The backend imports the current worktree application factory, never index.ts; startup confirms scheduled jobs are not started. Normal login and save/edit/delete behavior remain enabled. Startup and port-listening evidence only: no agent HTTP requests, login, business-data queries, smoke tests, migrations or data changes were made against the production-connected app. No code push or cloud deployment.


### Selected presentation finish — 2026-10-16

Kilian selected Coke Rot for the availability-before number/bar/swatch, keeping mint, recovered green and a sharp join. Removed the decorative result icon and replaced the long repeated heading with the one-line “Warenverfügbarkeit”. Isolated optimized build and four loading checks pass; actual-app1280/1440 proof has no panel overflow. Installed only the two presentation files into normal localhost3000 after hash checks and backup (`sm-coke-red-header-20261016-131650`). See `sm-dashboard-design-options.md` for evidence and rollback location. No data/API/formula changes or production verification.
