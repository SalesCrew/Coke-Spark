# Boni UI redesign — living plan

Updated: 2026-10-02. The user approved production release of the Boni work and the four GM Dashboard items. Isolated release checks passed; deployment is being published. Earlier no-push statements below describe the preceding local review stages.

## Constraints

- Production environment files and connections never enter tests, fixtures, screenshots or verification.
- Keep the existing page hierarchy: wave header, wave summary, tabs, four pillars, employee results and history; keep the editor's pillar navigation.
- GM Dashboard is a style reference only. Preserve its current per-card controls.
- Run a separate frontend on 3017 and synthetic in-memory PGlite backend on 4017. Leave the user's normal local app on 3000/4000 alone.

## Requirements and acceptance evidence

| Requirement | Implementation / acceptance | Status |
| --- | --- | --- |
| Coke Spark visual language | Compact gray typography, white cards, restrained borders, original gradient/raised buttons; consistent dropdowns throughout Boni | Verified; evidence in verification record |
| 70+ question assignment | Searchable bounded scrolling list; select/unselect in one click; applicable type/settings filtering; selection survives filtering | Verified; evidence in verification record |
| Expand source settings | Separate chevron exposes all existing answer, weight, section, chain, frequency and counting settings | Verified; evidence in verification record |
| Selectable UND requirements | Explicit independently selected metrics and thresholds on every payout tier, readable all-must-pass summary | Verified; evidence in verification record |
| Model fidelity | Verify saved PDF/Excel extracts; Q1/Q2 Flex gates, ratio/steps/net values, independent quality groups remain configurable | Verified; evidence in verification record |
| Whole-page polish | Overview, rules, employees, history, create/copy wave, dialogs, empty/loading/error/archived states | Verified; evidence in verification record |
| Thorough isolated verification | Unit/model tests plus actual browser flows, save/reload, gates, long list, keyboard/dropdown boundaries, desktop/mobile | Verified; evidence in verification record |
| Living documentation | Update this plan and separate verification record as work proceeds | Complete |

## Source and style audit

- Existing editor already stores an array of conditions per tier; backend AND behavior exists. Improve discoverability and selection rather than replacing the calculation model.
- Existing source UI requires adding a blank source and opening a long native select repeatedly; replace that interaction while retaining advanced controls.
- GM card dropdown/button reference: `src/components/admin/gm-dashboard/IppMiniDropdown.tsx`, white-to-gray gradient, subtle inset highlight and raised shadow, compact dimensions.
- Existing references: `praemien-saeulenmodell.md`, `docs/praemienwelle-quellen-und-regeln.md`; verify against saved extracts in the original checkout's `tmp/praemien-model-analysis`.
- Original PDF/Excel attachments are no longer present. Cached renders and text/cell extracts are available. Their historical rules are templates, not approval of new quarter rates.

## Work sequence

1. Confirm model/source evidence and current implementation.
2. Build reusable accessible Boni dropdown and source selector; improve AND tier editor.
3. Refine page/editor CSS and responsive layouts without changing navigation hierarchy.
4. Run isolated real-router preview and tests; correct issues found in browser.
5. Audit every requirement; leave isolated preview available and report local files.

## Implementation checkpoint

- Added `BoniSelect`: consistent gradient control, searchable long lists, keyboard arrows/Home/End/Enter, Escape returns focus, popup flips/positions within viewport.
- Replaced every native select within Boni workspace/editor; retained existing page tabs, pillar cards, employee drawer, create/copy and history layout.
- Added `QuestionSources`: bounded scrolling eligible-question list, type/search/assigned filters, individual toggles, bulk assignment, expanded detailed settings, readable source counts.
- Eligibility excludes unsupported text/photo/matrix inputs and already owned source identities. Availability respects one quote per metric; answer sums support up to the existing 100-source limit.
- AND editor shows all-required badge, independent metric selectors and live sentence; new conditions choose a different metric when available.
- Q1 template source discrepancy corrected: placement input is points at one per new placement, no invented 18→9 / 22→18 conversion. Existing saved models are not changed; only future selection of that template uses the correction.
- Inspected saved PDF page 10 and Q2 workbook `Flexziel - Kühler+RED!H2`: both component minimums required. Historical source names/values were not copied into fixtures.
- First isolated test run: 9 tests passed after correcting the Q1 unit conversion; frontend isolated typecheck and backend build passed. Old worktree Next cache references a deleted fixture route, so frontend check uses a clean isolated source copy.
- Manual browser: 81 assignments persisted with decimal factor, frequency, chains, section and counting settings; preview left revision/source storage unchanged; 100% + 49.99% gave €0, 100% + 50% gave €82.50.
- Full isolated browser regression passed: 56 checks across desktop, tablet and mobile. Final screenshots were inspected, including sources, AND tiers, rules, history, employee values, errors and archived views.
- Source-load failures now remain visible above the scrolling form, with retry that preserves unsaved assignments. Model validation feedback is visible in the same area.
- Type checks pass for the exact runtime source copy and backend; unit/integration tests pass 10/10. No native select remains in the Boni components.
- Final requirement audit is recorded below. The isolated preview stays available; production data and the normal local servers were not used for verification.

## Completion audit

| Objective item | Authoritative evidence | Outcome |
| --- | --- | --- |
| Read GM admin visual language first | Existing `IppMiniDropdown.tsx` gradient/borders/shadow reference; Boni CSS uses the same neutral raised control and Coke red primary style | Met |
| Redesign the whole page, approximately retain layout | Overview, rules, employee drawer/table, history, create/copy and archived screenshots; original header/tabs/four-pillar and editor navigation hierarchy remain | Met |
| Select 70+ eligible questions in a scrolling list | 80 numeric questions selected in bounded 400px region; 81 saved and reopened; type/search/assigned filters; 100-source limit tested | Met |
| Chevron exposes previous detailed controls | Persisted/reopened section, decimal weight, answer, chains, frequency and once/latest counting; additional assignment tested | Met |
| Choose independent UND targets with own thresholds | UI saved `coolers:50,racks:50`; 100/49.99 returned €0; 100/50 returned €82.50; boundary/missing tests cover both directions | Met |
| Handle supplied bonus models | Q1 PDF page 10 and Q2 H2 checked directly; Q1/Q2 template tests; ratio, net difference, point tiers, payout groups, limits and legacy guards covered | Met |
| Thorough synthetic dev-route verification | Completed browser manifest, 56 checks; 10 isolated unit/integration tests; frontend/backend type checks; 0 scoped axe violations and 0 browser runtime errors | Met |
| Every dropdown/button consistent | Shared `BoniSelect` across all Boni selects; long-list search, keyboard, Escape/Tab, focus trap and viewport tests; visual review at 1440/1024/390px | Met |
| Plan and maintain living Markdown | This plan plus `boni-ui-verification-living.md`, including commands, actual results, source evidence and limitations | Met |
| Protect production / do not push | Env-free isolated preview, whitelist launcher, synthetic auth and PGlite; runtime files match source; no deployment, push or production test call | Met |

No required implementation or verification work remains for this local redesign. New quarter rates and unconfirmed quality definitions remain explicitly configurable; the task supplies no authorization to invent them.

## Follow-up: independent goals and current Kühler/X-Mas rules (2026-10-02)

The user supplied four new screenshots and reported that the previous AND control was confusing. The earlier completion audit applies to the previous scope only.

- Two independent named goals, each with a 50%/100% milestone; AND must never silently duplicate a single goal.
- Kühler: net 0 gives 5 points (50%), net +1 gives 10 points (100%). New + recovered minus returns + lost; branch closures excluded.
- X-Mas: truck cab plus first trailer 3 points; additional trailers, Schütte, FSDU, Schlittenschürze 1; Palettenschürze/Standee 0.5. All brands/SKUs. Milestones 20/28 raw points.
- Both minimums required; raw X-Mas points plus stepped Kühler points: 25 → €82.50, 30 → €165. Full payout does not require both component goals at 100%.
- Eight-week stay and Execution Manager/email reporting cannot be proven by the current bonus observation schema. Explicit manual review is required before payout.
- Displays 70/80/95 → €275/440/550; Distribution 80/90 → €82.50/165. Existing templates cover these.
- User says quality is entered manually, with uncertain percentage rules. Use reviewed Euro payouts capped at Reporting €55, Survey/Bildertags €55, Zeitmanagement €110. Do not invent automatic percentage thresholds.
- New template only; old saved models and Q1/Q2/Q3 templates retain their meaning. No production access, push or deployment.

Status: implemented and verified locally. See the follow-up record in `boni-ui-verification-living.md`.

| Follow-up requirement | Evidence | Result |
| --- | --- | --- |
| Two independently named goals, each 50% | Fresh empty draft → add AND → new focused goal-name input → separate 50% dropdowns → save; 100/49.99 denied, 50/50 paid €82.50 | Passed |
| Correct current Flex weights and payout | Weighted 3/1/0.5 category tests, independent minima, raw combined points 25/30; browser 0 net + 20/25 Xmas → €82.50/165 | Passed |
| Cooler qualification details | Qualified new/recovered counts; separate returns/lost excluding closures; required manual eight-week/reporting confirmation. Missing/failed confirmation denies payout | Passed, manual evidence review |
| Quality manual entry | Three capped Euro amounts (€55/55/110), optional full-amount shortcut; no invented percentage thresholds; null vs 0 and cap validation covered | Passed |
| Existing models preserve meaning | Additive JSON fields; existing Q1/Q2/Q3 templates unchanged by this follow-up; existing entries retain unit/removal protections | Passed |
| Isolated verification and preview | 24 tests, frontend/backend production-source typechecks, git diff whitespace checks, matching runtime source copies, no env files | Passed |

Preview: `http://localhost:3017/admin/praemien`. Default wave is **Kühler + X-Mas · synthetisches Beispiel**, with three synthetic scenarios. This is a disposable preview, not production data. No push or deployment.

## Authorized release — 2026-10-02

- Release the approved Boni editor, independent goals, Kühler/X-Mas draft template and manually reviewed quality amounts.
- Include availability REWE/SPAR shortcuts, per-question competitor details and explicit-Ja RED counting. Preserve the already deployed original per-card multi-select filters and individual chain rows.
- Release preflight: 63 isolated unit/component/PGlite integration checks passed; frontend optimized production build and backend TypeScript build passed; environment files excluded and only synthetic placeholders supplied.
- Publish the backend first, then the frontend, through each repository's existing `master` deployment integration. Confirm exact commits and platform deployment states; do not query the production application/database for verification.
- No migration, seed, wave/model rewrite or production-data change is part of this release.
