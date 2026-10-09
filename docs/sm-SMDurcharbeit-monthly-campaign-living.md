# SM Durcharbeit — monthly campaigns · living plan

Status: local end-to-end implementation and isolated verification complete; the two specifically authorized monthly migrations are now applied and code delivery is proceeding backend first. Updated 2026-10-09, Europe/Vienna. See [the production release package](sm-SMDurcharbeit-monthly-production-release.md) for artifact hashes, authorization, ledger identities and delivery evidence.
Scope: the user explicitly authorized only the two reviewed new production migrations, necessary schema/migration metadata checks and backend/frontend deployment. Production business-data access, imports, historical conversion and campaign activation remain outside scope. Earlier local-only statements below describe their historical checkpoints; this current release record supersedes their pending-authorization status.

Recommendation: introduce a separate SM campaign with one target per assigned market/calendar month. Reuse the existing SM questionnaire engine for each real visit. Same-month follow-ups inherit answers with provenance; the next month has its own empty state. Keep every existing dated Einsatz and historical answer/photo/time link intact.

Employee entry point: a minimal blue-accented market list below the current calendar; Nachrichten can move into an SM-only Home-menu panel. Admin uses a dedicated campaign/month workspace, with actual visits still visible in management, activities, time tracking and photo archive. The main risks are photo retention, monthly state/concurrency and time/report consumers currently coupled to dated assignments; the plan below treats those as release gates.

## 1. Authoritative requirements

The user's current request and the supplied 2026-10-08 conversation supersede the earlier date-based Durcharbeit planning design. Earlier plans describe the shipped legacy implementation; they must not override this specification.

| ID | Requirement | Source / confidence |
| --- | --- | --- |
| R1 | Durcharbeit is a campaign spanning several weeks/months, initially October–December. | Doris, 15:38; confirmed by user. |
| R2 | Markets are assigned to a particular SM; there is no preplanned visit date or time. SMs choose when to visit their own markets. | Doris, 16:07–16:08. |
| R3 | The imported Excel `Verplanung` person is the intended assignee; resolve to stable application user IDs, never authorize by a display name. | Supplied conversation; import source inspection. |
| R4 | The market roster normally stays the same across all three months, but a market can close or an assignee can change. | Doris, 16:10. |
| R5 | Each included market must be completed at least once in each normal calendar month; RED months do not apply. | Doris, 17:07; explicit user clarification. |
| R6 | Answers persist across follow-up visits within the same month. Start the next calendar month with a separate empty monthly answer state. | Explicit user request; the earlier ambiguous “ja könnten wir so machen” is not the sole evidence. |
| R7 | The questionnaire normally stays the same. Preserve versions/snapshots of any visit already started or saved. | Doris, 17:07; user's historical-data invariant. |
| R8 | Employee home needs an undated, selectable Durcharbeit market list and a start/resume visit action. Completed monthly targets move down. | User request and completion goal in supplied conversation. |
| R9 | Admin Durcharbeit planning/management must become campaign-oriented, with reporting and photos wired through the full flow. | User request and existing app dependencies. |
| R10 | Consider moving the SM Nachrichten panel into the Home menu alongside Kurti and using its dashboard space below the calendar for the new list. | User's proposed placement; design recommendation, not an instruction to alter GM. |
| R11 | Existing historical business data, IDs, links, saved answers, photo objects, timings, and standard SM/GM behavior remain intact. | Standing user constraint and AGENTS.md. |

## 2. Safety and evidence boundary

- Source checked in the current managed worktree, frontend `2dd214f`, backend `a77c2f5`. Working trees initially contain no pending application source changes; dependency symlinks and local tool cache are untracked.
- Original checkout is older and has historical local changes. Do not reset it or publish its old preview configuration over the current release.
- Production-connected environment files and human localhost:3000/4000 are not used for discovery or verification.
- No direct production queries, live record counts, attachment contents from production, or assumptions about how many campaigns/visits already exist.
- The user's statement that import succeeded is accepted as operational feedback; source inspection establishes import semantics, not production contents.
- Future tests use disposable synthetic DB/storage and independent 3037/4037; future production DDL requires explicit authorization. Never run a backfill/conversion/cleanup as part of this redesign.

## 3. Confirmed baseline before implementation

1. `/admin/sm/durcharbeit-verplanung` renders `SmVerplanungWorkspace SMDurcharbeit`; it is not a campaign engine.
2. Employee `SmDashboardSchedule` loads date-ranged planning assignments, groups them by `effective.workDate`, displays `plannedMinutes`, and opens `/sm/marktbesuch?assignmentId=…`.
3. Existing Durcharbeit identity is derived from immutable questionnaire stable codes and submission snapshots; registry membership is only a fallback for unstarted assignments.
4. Imported dedicated markets retain stable `sm_markets` bridge IDs and `sm_smdurcharbeit_markets` metadata. All rows, including duplicate-looking entries, were intentionally preserved; roster identity must remain the existing row ID.
5. The current questionnaire resolver prioritizes frozen submission, explicit override, central default, then legacy selection. Its `oncePerMarket` guard is lifetime/template-wide, incompatible with monthly completion/follow-up if reused unchanged.
6. Visit APIs, photo actions, answer queues and start/resume currently use assignment IDs. The downstream reporting/time audit below establishes the required typed execution adapters without inventing dates or planned minutes.
7. `sm_assignments` requires a real work date and strictly positive planned minutes; its source enum is single/series. Do not represent monthly campaign targets as fake dated Einsätze or weaken these historical constraints.
8. `sm_questionnaire_submissions.assignment_id` is already nullable. Management and photo archive use left joins; their basic submitted-visit visibility can reuse the existing immutable snapshot graph. Employee completed activities, time tracking, and the overlap guard depend on assignment/time-submission joins and need explicit campaign support.
9. The time-overlap guard currently excludes records without an assignment time-submission. Merely adding a new visit route would allow conflicting time intervals unless this guard and both old/new writers share the same SM-level transaction lock.
10. Lifetime `oncePerMarket` is enforced by both service logic and a partial unique index. New campaign visits need a separate monthly completion policy; do not change that flag or uniqueness policy for old submissions/templates.
11. Existing follow-up photos cannot be implemented by copying storage paths and later running ordinary draft cleanup: file identity, provenance, and retained historical references need explicit handling.
12. Questionnaire deletion protection currently covers central selection and pending dated overrides. Live campaign/month references must also block destructive catalog changes, while old visit snapshots remain readable.

## 4. Discovery checklist

- [x] Capture requirements and inspect current repository state.
- [x] Locate dedicated market import and current date-based Durcharbeit page.
- [x] Inspect schema constraints and complete visit snapshot/answer/photo/timing lifecycle.
- [x] Inspect employee home, messages, menu, offline/cache and session routing.
- [x] Inspect admin campaign patterns, SM management/dashboard, exports, photo archive and dependent joins located by source search.
- [x] Choose campaign/month/visit model with explicit history guarantees and tradeoffs.
- [x] Specify API/UI transitions, concurrency, reassignment, month rollover, questionnaire versions and failure behavior.
- [x] Specify additive migration/release boundaries and isolated verification matrix.
- [x] Audit every requirement against source evidence and finish the verdict.

## 5. Investigation log

- 2026-10-09: Established the latest worktree/commits, read standing production rules, and captured the new campaign-only business requirements. Confirmed the existing Durcharbeit planning wrapper is dated SM planning and the employee entry point requires an assignment ID. No production access or application changes.
- 2026-10-09: Traced nullable submission links, immutable questionnaire snapshots, draft/submit/photo actions, owner-specific queues, message/menu placement, activity and time joins, overlap locking, and questionnaire deletion guards. Rejected fake scheduled assignments; designing a separate monthly campaign target and execution context with the existing answer engine.
- 2026-10-09: Completed the dependency map including GM pattern limits, management/dashboard date semantics, employee activity/time joins, archive/ZIP, registry and account/deactivation/DSAR dependencies. Wrote the proposed additive model, full monthly lifecycle, UI/API/reporting contracts, isolated verification matrix, cutover/rollback and risk verdict.
- 2026-10-09: Final static audit checked 46 concrete source references for file existence/anchor bounds, resolved the live-draft uniqueness on authoritative submission state, kept follow-up rows in the completed group, and audited R1–R11. Only this document is new; no application or production operation was performed.
- 2026-10-09 implementation: user requested the end-to-end build. Verified current branches again, reviewed current Supabase RLS/storage documentation and CLI help, and started an additive local migration artifact. Proceeding with the documented safe edge defaults; all verification remains isolated/synthetic, without production migration/activation/deployment.

This remains a living implementation handoff. Unresolved product choices are marked as proposed defaults/decisions to review, not silently treated as confirmed requirements.

## 6. Architecture decision

**Recommendation: a first-class SM Durcharbeit campaign, a target per market/calendar month, and separate physical visits.** Reuse the SM questionnaire snapshot/answer/validation engine through an explicit execution adapter. Do not reuse GM campaign tables or manufacture a dated SM assignment.

The three distinct identities are:

1. **Campaign / roster:** what must be visited, which questionnaire version applies, which SM owns each market, and the campaign date window.
2. **Monthly target:** `(campaign ID, existing SM market ID, calendar month)`. It has one completion goal and the current monthly answer state. The employee is deliberately not part of this unique key: reassignment must not create a second goal or reset completion.
3. **Physical visit:** one actual start/resume/submit session. A target can have multiple sequential visits. Each has its own immutable questionnaire snapshot, answer revisions, photos/provenance, actual time, author, submission receipt, and audit trail.

Example, entirely synthetic: market A has three targets in an October–December campaign. A submitted October visit completes October. A second October visit starts with October's latest valid submitted answers, retains the first visit, and does not increase monthly coverage beyond one. The November target starts empty. Each physical visit still contributes its own actual worked time.

### Alternatives considered

| Approach | Verdict / reason |
| --- | --- |
| Create one dated Einsatz on the first/last day of each month | Reject: invents a day and positive planned minutes; pollutes calendar/Soll/time/change requests and cannot cleanly distinguish monthly goal from follow-up. |
| Make dates/minutes optional in the existing planning domain | Reject for this scope: weakens existing database/type invariants and makes every standard planning consumer handle undated work. |
| Put SM markets into existing GM `campaigns` / `campaign_market_assignments` | Reject: GM market/user/questionnaire domain, GM-specific behavior and cascading relationships differ. Borrow interaction patterns, not tables or authorization. |
| Reset/overwrite one questionnaire submission each month | Reject: destroys historical answers/times/photos or breaks their links. |
| Separate campaign targets with new execution records and existing SM submissions | Choose: additive domain, clear month identity, stable historical links, independent undated UI, shared question configuration/validation. Requires deliberate integration of time, activity, archive, management and caches. |

### Additive data model — implementation evidence in §14

Keep `SMDurcharbeit` in new application symbols and `smdurcharbeit` in new SQL table/column names. Existing identifiers are untouched.

| New table / field | Essential content and invariants |
| --- | --- |
| `sm_smdurcharbeit_campaigns` | UUID; name; state `draft / published / paused / archived`; inclusive start/end DATE; timezone fixed `Europe/Vienna`; default pinned SM questionnaire template/version pair; revision; actor/time audit. Effective `scheduled / active / ended` is derived from window + state, without a rollover job. End >= start. |
| `sm_smdurcharbeit_campaign_markets` | UUID; campaign FK; **existing** dedicated `sm_market_id` FK; membership/audit state. Unique campaign + market ID. Never deduplicate by address/name; preserve every imported registry row and its bridge ID. Only registry markets can be newly selected. |
| `sm_smdurcharbeit_assignment_revisions` | Append-only roster assignment history: campaign-market FK; active SM user ID (or unresolved draft state); business effective month; optional explicit current-month change timestamp; reason/actor; source imported person text retained as provenance. Names never authorize access. |
| `sm_smdurcharbeit_campaign_periods` | Campaign FK + first-of-month DATE, unique; start inclusive/end exclusive intersection of campaign window with calendar month; pinned questionnaire version; revision/audit. Explicit future version changes are optional, never automatic quarter/global-default changes. |
| `sm_smdurcharbeit_month_targets` | Period FK + campaign-market FK, unique; initial and current owner-revision IDs; market/name/address snapshot; eligibility `required / waived` with reason/event; current draft visit pointer; latest valid submitted visit pointer; revision. Target identity is stable across an employee change. Completion is derived from valid submitted visits, not editable as an unexplained boolean. |
| `sm_smdurcharbeit_visits` | Target FK; owner revision at start; pinned questionnaire version; visit sequence; basis submission ID + basis state revision for follow-up; audit identity. Lifecycle/answer/timing snapshot is authoritative on the linked existing SM submission, not a second independently editable visit status. Each submitted physical visit is separate, never superseded merely because a follow-up exists. |
| `sm_questionnaire_submissions.SMDurcharbeitVisitId` + `SMDurcharbeitTargetId` / SQL `smdurcharbeit_visit_id` + `smdurcharbeit_target_id` | Nullable unique execution FK plus target FK constrained to that execution's target. Existing rows remain null; new campaign rows have both links and **no** `assignment_id`. Preserve legal legacy records with neither context. The target link enables a partial unique live-draft index on the authoritative submission state. Composite/reference validation binds visit, target, market, owner and pinned template/version. |
| `sm_smdurcharbeit_visit_time_revisions` | Actual start/end, duration and travel minutes; revision/current flag; author/reason; visit FK. Append revisions for approved corrections. No planned day, planned minutes or invented flat rate. Existing assignment time tables remain intact. |
| `sm_smdurcharbeit_time_change_requests` | Campaign visit ID + expected current time revision; employee request for correction/deletion; reason, idempotency token, reviewer and audit. Mirrors current SM approval behavior without pretending there is an assignment ID. |
| `sm_smdurcharbeit_answer_provenance` | New answer ID -> source answer/submission ID, source monthly revision, copied timestamp. Preserve explicit empty/cleared answers, comments and source identity. Never carry ownership, time or mutation tokens into a new visit. |
| `sm_smdurcharbeit_answer_file_links` | New answer ID -> canonical existing `sm_question_answer_files.id`; question/context/origin captured separately. No duplicated upload/object or invented photo timestamp. Unlinking an inherited photo removes only that new answer's link. |
| `sm_smdurcharbeit_events` | Campaign/period/target/visit context as applicable; actor; reason; before/after/revision; idempotent action identity. Covers publication, roster changes, waivers, reactivation, follow-up basis, corrections, deletion/invalidation and extension. No secrets/photo URLs in audit. |

Prefer period/target tables created in the publication transaction for the selected campaign months, so future totals and assignments are inspectable. No nightly target-generating, resetting, or answer-copying job. Bound the publication size; stage a preview and transactionally publish the reviewed revision. For unusually long/large campaigns, choose a bounded publication strategy before implementation rather than partial silent success.

### Constraints, indexes and privileges

- Reuse existing UUIDs, SM registry and published questionnaire versions; FKs `RESTRICT`, no cascading business-history deletion. Add indexes to every new FK and hot owner+period/state lookup.
- Enforce unique campaign+market, campaign+calendar-month, target per period+membership, execution idempotency, submission per execution, and one active draft with database constraints, not only UI state.
- The live-draft partial unique index is on the new nullable submission target link where `status = 'draft'`, current, and not deleted. Target draft/latest pointers are transactional read-model references, not an independently editable status. Publication/start creates graph and pointers atomically; do not add a second lifecycle flag that can diverge from submission state.
- Validate month DATE is its month's first day; period overlaps campaign; roster market belongs to the same campaign as the period; version belongs to its template. Use composite keys/constraints where possible, transactional validation for cross-row/window rules.
- Monthly target uniqueness **permits** follow-ups. Do not enforce one physical submission per month. The completion/read-model pointer chooses one latest state while preserving all visits.
- For **new** campaign submissions set the legacy `once_per_market_snapshot` to false and record the explicit monthly policy in the new context. This avoids the lifetime partial index without changing the old template/version flag or any historical submission. Central/dated selection keeps its old rules.
- New tables use the existing server-mediated auth/RLS convention, deny public/anonymous direct access, keep service credentials on the backend, and provide no broad browser table grants. Verify real PostgreSQL FK/unique/RLS behavior in a disposable environment; PGlite alone does not prove these properties.
- Publication/start/roster edits lock the campaign or target rows with a documented order; answers use existing expected-version/idempotent mutation checks. Use transaction-level locks, not session locks, because of pooling. Avoid adding every new action to the global dated-planning lock.
- One SM-level time lock is shared by standard and new campaign submit/correction paths. A neutral typed time query must see both domains. Existing standard work must also reject a conflict with a campaign visit.

## 7. Business rules and state transitions

Items explicitly marked **proposed default** need product review before implementation. The plan is complete without pretending those unspecified edge cases were confirmed by Doris.

### Calendar month and availability

- Server derives business month in `Europe/Vienna`; client/device timezone never determines the target. Store the month key as DATE, timestamps as UTC timestamptz. A month is `[local first-day midnight, next local first-day midnight)`; DST makes fixed 30-day / 24-hour arithmetic unsuitable.
- A campaign is selectable only when published, within its date window, the target is required, the assigned SM account is active, and the pinned questionnaire is available for that campaign. Pausing blocks new starts; it does not erase the roster or historic results.
- October, November and December are separate targets. Rollover changes which target is current; it performs **no reset/update/delete of October answers**. GET endpoints never materialize or mutate targets.
- **Proposed default:** partial first/last months still require one visit per included market in the intersecting campaign window. The admin sees the shorter window before publication. There is no prorated visit count.
- Campaign extension creates only additional future periods/targets. Same-month extension retains target identity, monthly answers and completion. Changing a start date/end date must not shrink a period containing a started or submitted visit. Ending/archiving hides new-start actions while keeping detail/history.
- **Proposed default:** ordinary new visits are current-month only. Future targets are preview-only; past months are history-only. Any retrospective completion would require an explicit separately reviewed admin exception with audit, never an arbitrary month supplied by the employee.

### First visit, resume, follow-up and completion

1. Employee selects one of their own currently available targets. Server returns a pre-start context including campaign, calendar month, market, pinned questionnaire and target revision; loading this does not create a visit.
2. Start validates owner/role, campaign window/state, target eligibility, version and expected revision in a transaction. Existing live draft returns the same receipt. New start token retries return the same execution/submission; two tabs cannot create duplicate live drafts.
3. No previous valid submission this month -> snapshot the selected questionnaire and initialize empty answers.
4. A draft exists -> resume the exact draft, including files, current question and saved timing. Do not clone a new visit merely because the user navigated away or refreshed.
5. Latest valid submitted visit exists -> explicit **Folgebesuch starten** creates a new physical visit with that month's answers as its basis. Prior visit remains submitted, readable and attributed to its original author; `is_current` is not turned off to make a follow-up.
6. Submit validates current answers, conditional applicability, required questions/comments/photos, timing and auth again. In one transaction record submitted snapshot, current actual time revision, monthly latest pointer, audit and receipt. Repeated submit returns the same receipt and does not add another completion/time entry.
7. First valid submitted visit -> target completed, row moves below open targets. Starting or discarding a follow-up does not make a completed target open again. Submit of follow-up updates the monthly answer state but monthly completed count stays one.
8. Draft discard affects only that execution and its owned uncommitted uploads. A cancelled draft does not destroy the month's previous answer state or completion. Submitted visits use existing correction/invalidation review semantics, not draft discard.
9. If an authorized invalidation removes a contributing visit, recompute the monthly latest valid state and completion from remaining valid submitted visits. If none remain, the target becomes open. Record why; do not hard-delete visits or silently count an invalidated submission.

### Same-month carry-over for every supported question configuration

- Use the latest **valid submitted snapshot of this exact target/month**, not today's global template, another market, another campaign, another month, or a draft on a different device.
- Match immutable question/version identity and compatible option codes/config; never use question label text alone. The same pinned version makes this deterministic.
- Carry current answer values for single choice, yes/no, yes/no multi with branch choices, multiple choice, Likert, text, numeric, slider, matrix cells, photo links and any applicable conditional comments. Preserve explicit empty/cleared values so an older answer is not resurrected.
- Freeze a fresh question/module/config/options/logic snapshot for each execution. Preserve subheadings, question order, required flags, scoring/metric roles, OOS detection/remediation links and `partialCountsAsResolved` behavior. Recompute applicability and validation on the new graph; do not copy cached score/count totals or blindly mark hidden questions answered.
- Copy with new answer/option/matrix IDs, new owner-specific mutation tokens, fresh local answer-version baselines, and recorded provenance. The source submission, answer versions/events and timestamps are not changed. A copied answer is visibly prefilled, never presented as a new photo capture or fresh observation time.
- Author/travel/manual time/start/end/receipt/target completion timestamps are **not** questionnaire answers and are never copied from the previous visit.
- Month-two first visit starts empty even if the same questionnaire version and market were completed in month one.
- Pin version at campaign publication. Editing/publishing a template later does not rewrite a running month's snapshot or switch an in-progress visit. **Proposed default:** only explicitly selected changes for future, entirely unstarted periods are allowed. If such a future month uses a new version, it is empty as usual; cross-version same-month answer migration is outside this scope.
- If an admin correction/another legitimate revision changes the carry-over source while a follow-up draft is open, keep that draft's recorded basis. Block final publication against an unexpected monthly basis revision and offer reload/review; never silently overwrite the employee's draft or silently publish stale answers over newer reviewed data.

### Photos and storage

Carry-over includes photos as references with **original capture/upload visit, owner and date**. Do not duplicate the storage object or mutate the canonical historical file row. All read/sign operations must authorize the new answer link and its target as well as the object identity; a UUID in a client payload is not sufficient authorization.

New visit uploads stay in an execution/submission/answer-owned prefix using the existing private bucket policy, accepted mime/size limits, upload receipt proof, commit validation and signed URL expiry. Failed-upload cleanup only accepts uncommitted objects owned by the current execution. Copying an old storage path into a new draft must never grant deletion rights.

Removing a carried photo unlinks it from this draft only. Removing a new draft upload checks retained references before deleting the object. Source submission invalidation may remove its answer from the live archive, but must not break a legitimate retained copy/reference; this requires the canonical-file resolver and archive query to respect authorized retained links. No automated cleanup/backfill for old objects is part of this release.

Archive's normal photo stream shows physical uploads once with their origin date/author. Campaign monthly-answer views can show retained references and identify the origin. ZIP manifests include campaign/target/business month and origin IDs/date, with an explicit deduplication policy; carry-over is not another uploaded photo. Avoid leaking photos to a newly assigned employee outside the targets/months they are authorized to handle.

### Employee reassignment, closed markets and roster editing

- Publication uses the existing registry `assigned_sm_user_id` as the resolved initial person and preserves Excel `Verplanung` text as provenance. Existing import uses normalized exact name keys and only accepts a unique active SM match. Ambiguous/missing matches stay unresolved; do not silently select the first/fuzzy match. Resolve these in the campaign preview before publication.
- Default edits apply to future unstarted monthly targets. A current-month change is an explicit scope choice with expected revision and audit, never a global rewrite of old visits.
- A reassignment changes who may start/resume next work; it does not change who authored a submitted visit. Monthly completion belongs to the campaign-market-month, so it stays completed if the new employee takes over a market already visited that month.
- **Proposed default for a current live draft:** block immediate transfer and show the draft owner/status. Admin chooses an audited cancellation/resolution before transferring the open target; no automatic handover of another person's draft or times. Existing original employee history remains accessible under existing own-history permissions after reassignment.
- Closed markets are explicitly waived for current open/future targets, with reason and event. Completed past targets and their denominator remain frozen. Report required, completed, waived and unresolved separately; preserve the previous obligation/history in audit. No replacement of market ID inside a historic visit.
- A waived target keeps any old submitted visits readable. Reopening in the same month restores the same target identity; completed remains completed if a valid visit exists. Future reopening creates/reactivates future obligations through reviewed roster changes.
- Account deactivation, market archival, registry re-import and name/address edits must surface campaign dependencies in the existing preview/guard flows. Do not let an import implicitly move ownership, add new campaign obligations, waive markets or rewrite existing snapshots. “Apply registry changes to campaign” would be an explicit future/current-unstarted reconciliation with preview.
- **Proposed default:** warn/block overlapping active campaigns for the same market and month unless an admin deliberately confirms independent obligations. If allowed, state and carry-over are isolated by campaign ID, never silently merged.

### Boundary, offline and consistency rules

- Target/month is pinned at successful server start. A client reopening an October draft in November must see that it is an October draft; do not silently route its cached answers into November.
- **Proposed default:** after the period/campaign closes, allow read/recovery of the draft but block employee submit until an admin explicitly grants a recorded exception. This prevents late entries from silently changing a closed monthly report. A visit spanning midnight must be submitted within that rule; show a warning before starting near the boundary. The exact late-entry policy is a product decision, not yet confirmed.
- Business month and physical worked date are distinct. Time reports use actual corrected visit start/date and duration; monthly coverage uses the stored target period. Corrections crossing month boundaries do not silently change target identity. Impossible time/month combinations require an audited admin exception or rejection.
- Cache and queue keys include authenticated owner + context discriminator (`assignment` vs `SMDurcharbeit`) + target/month + execution/submission + pinned version/revision. Old assignment queues retain their existing meaning; migrate neither them nor production data implicitly.
- Stale campaign/roster/month revision -> explicit conflict + refresh/review, without losing the local draft. Mutation expected-answer-version remains mandatory. Account switch/logout prevents delayed responses, photo exports and pending writes from rendering/replaying under another owner.
- Revalidate on focus, online, visible-tab and Vienna month boundary; new current-month list appears without reload. Failed requests show last loaded state as stale, never convert missing data into zero completed/open targets. Navigation/skeletons must not create/submit a visit.
- Actual-time overlap validation sees standard and campaign submissions together, excludes only the exact physical execution being corrected, and holds the existing SM-level transaction lock across check + write. Do not exclude all null-assignment rows. Consistent lock order prevents submit/roster/correction deadlocks.

## 8. UI recommendation

### SM employee home

Keep the current order/appearance of `SmDashboardHero`, normal date-bound visits and the week calendar. Beneath the calendar place the new **Durcharbeit** list where Nachrichten currently sits. No insertion of undated obligations into the calendar or fake planned visit rows. Historic dated Durcharbeit assignments keep their current dated-row behavior.

Use the app's clean white card/row pattern, same content width and spacing, with restrained blue icon/text/selection accents. No large blue explanatory panel, colored card border, or pill wall. The main information is market name, address, campaign and month; show a compact `completed / required` counter in the heading. With multiple campaigns use a compact selector, not duplicate full dashboard sections per campaign.

Monthly-open targets sort first, with resumable drafts before unstarted markets; completed targets stay below them, with an active follow-up first within that completed group. Use stable market-name/address ordering within the remaining groups; do not change order while typing/searching. Search only the employee's assigned targets. Each row has one clear primary action:

| Target | Action / presentation |
| --- | --- |
| Open/current | `Besuch starten`; pre-start view shows campaign/month/questionnaire, then existing timer/manual/travel flow. |
| Own live draft | `Fortsetzen`; shows retained save state. No second draft/start button. |
| Completed/current | Moved below open targets, minimal completion date; `Folgebesuch` secondary action. Retained answers are explained when starting, without new banners everywhere. |
| Future month | View-only planned roster and campaign availability; no start action. |
| Past month | Read-only history/results; no ordinary retroactive start or silently continuing current-month work. |
| Waived / missing owner / unavailable questionnaire | Appropriate explicit status, no start. Employee does not receive unassigned/other employee targets; admin sees resolution needs. |

The monthly selector is independent of the week calendar. Changing the calendar day must not hide the monthly campaign list. Current month is the default on open; Vienna rollover refreshes it. Own historical visit details remain reachable even after current roster ownership changes.

Pre-start is a dedicated `/sm/durcharbeit-besuch` route with exactly one typed target/visit reference. After successful start, replace the URL with the execution visit ID for refresh/resume. Reuse the question renderer and timing/review/receipt components through a typed adapter; preserve `/sm/marktbesuch?assignmentId=…` and all old deep links. The paused-visit notice supports both context types without rewriting old session storage.

### Nachrichten in the Home menu

Recommendation: move the existing SM Nachrichten body into an SM-only menu panel alongside Kurti, with an unread count/indicator and a clear `Nachrichten` entry. Reuse the recipient/read logic; opening the menu or loading the unread count must **not** mark a message read. Preserve explicit confirmation, visibility-after-read rules and current unread navigation behavior.

Use an opt-in menu extension with default absent, so GM and other surfaces do not gain the new panel. Consolidate the duplicated SM menu definitions or provide an SM wrapper so Home, Aktivitäten, Zeiterfassung and Profil show the same entry. Keep Kurti separate from employee messages; do not send message contents to Kurti or change any recipient permissions.

Load unread metadata cheaply in the background; load body on open, with clean bounded skeleton/error/retry. Handle focus/Escape/back navigation, viewport/keyboard height, touch and overlay collisions with paused visit/settings/Kurti. If this move is deferred, the campaign list can appear below Nachrichten temporarily; do not remove the sole message entry before the replacement is usable. This placement remains a design recommendation for user review.

### Admin Durcharbeit campaigns and management

- Replace the current **dated** Durcharbeit Verplanung workspace with its own campaign workspace. Keep the current URL/bookmark (`/admin/sm/durcharbeit-verplanung`) and propose label **Durcharbeit Kampagnen** under Management. Do not rename the existing blue questionnaire-editor page `/admin/sm/durcharbeit`; it remains under Fragebögen.
- GM campaign UI is inspiration: clean campaign list with active/scheduled/paused/ended identity, date window, questionnaire name/version and monthly completed/required progress. No calendar-day drag-and-drop, planned minutes, holiday shifting or weekly-series controls for new campaigns.
- Create/edit drawer: campaign name, start/end, existing published Durcharbeit questionnaire, registry-only markets, resolved SM assignments and preview. Seed assignees from the imported stable mapping, then allow deliberate corrections. Distinguish campaign window dates from **absence of per-market date/time**.
- Month tabs/selector show October/November/December coverage, per-SM totals, open/completed/waived/unassigned targets. Clicking a target shows visits and current monthly questionnaire state; clicking a visit opens existing management detail by submission ID.
- Roster edit offers explicit scope (future unstarted months or reviewed current month). Preview protected drafts/completed targets and reasons before applying. Campaign pause/extend/archive controls retain history; no hard-delete or automatic cancellation of old Einsätze.
- Keep a reachable **Bisherige datierte Durcharbeit-Einsätze** history/operations view using the existing workspace/code. Old assigned work remains accessible to its owner. If new campaign publication would overlap an unfinished dated obligation for the same market/month, show a warning and require a separate deliberate resolution. Never automatically convert, cancel, duplicate or complete that dated assignment.
- Existing SM FB Management continues to show all actual submitted visits and snapshots, including standard, legacy Durcharbeit and new campaign visits. Add campaign + business-month context/filter, monthly latest-state view and visit history. Retain standard filters, detail corrections, answer change/deletion reviews, photos, deep links and actual-time edit actions.
- Photo archive retains its current clean GM-style filters. Add optional campaign/business-month refinements in a consistent compact layout. Clearly distinguish physical upload date from business month and retained photo provenance. Existing Standard/Durcharbeit scope remains valid; historic DA is not relabelled as a new campaign.
- Existing Durcharbeit markets import/editor and blue questionnaire editor remain wired, not recreated. Show campaign dependencies when editing/deactivating the relevant entity. Sidebar active matching stays path-segment bounded so Durcharbeit questionnaire and campaign pages are not both selected.

### Loading and performance

- Independent home loaders: today's existing hero/schedule stays priority; campaign summary/first visible rows next; filter facets/history and Nachrichten body afterwards. Errors on one loader do not blank another or get represented as zero.
- Backend list queries batch roster/target/current draft/latest-submission references; no per-row questionnaire/answer/photo-signing queries. Return summaries and typed action state first. Fetch full answer graph only when a visit/detail opens; sign photos only for visible authorized detail/archive batches.
- Owner/month/campaign-aware request cancellation and revision checks protect against delayed responses. Reuse skeleton spacing and reduced-motion behavior. Do not introduce new package/UI framework merely for these lists.
- Paginate large admin lists and archive exports; use indexes and bounded query budgets verified against large synthetic fixtures. Employee lists can use bounded page/incremental display without losing server-wide search or `completed / required` totals. Do not derive totals from just the loaded page.

## 9. Dependency audit and implementation map

Source anchors below refer to the current worktree stated in §2. They are inspection evidence, not claims that the new model exists. Paths are repository-relative; backend is a separate repository.

| Surface / source anchor | Observed dependency | Required new handling / preserved behavior |
| --- | --- | --- |
| `src/app/admin/sm/durcharbeit-verplanung/page.tsx` | Thin dated-planning wrapper. | Dedicated campaign workspace, retained legacy dated view/bookmark. |
| `src/components/admin/sm/SmVerplanungWorkspace.tsx` | Work date, positive minutes, holiday/date/series controls. | Reuse only legacy view and generic controls; no new monthly targets in its assignment model. Normal Verplanung untouched. |
| `backend/src/lib/schema.ts:983`, `:1156`, `:1393` | Dated assignment constraints, nullable submission assignment, lifetime once-per-market index, files owned by answer. | Add new entities/context links; preserve old constraints and every old row. Canonical photo links and reference-safe cleanup. |
| `backend/src/routes/sm-SMDurcharbeit-markets.ts:32`, `backend/src/sm-SMDurcharbeit-market-import.shared.ts` | Unique normalized exact active-person match, stable occurrence-aware source keys/bridge IDs. | Use existing roster IDs/resolved owner, unresolved preview, no implicit re-import campaign sync or duplicate collapse. |
| `backend/src/sm-SMDurcharbeit-selection.shared.ts` | Frozen submission -> override -> central -> legacy; lifetime guard and pending override references. | New campaign selection adapter pinned by period/version, monthly policy distinct; keep dated precedence/identity unchanged. |
| `backend/src/routes/sm-questionnaires.ts:901`, `:1120` | Inactivation/deletion guard checks dated overrides/central assignment. | Guard live campaign/period references and protect published versions. Existing module/question configuration and versioning preserved. |
| `backend/src/routes/sm-visits.ts:186`, `:231`, `:397`, `:699`, `:1071`, `:1234` | Owner/context via assignment; snapshot graph, start token, answer versions, conditional recalculation, submit/time receipt. | Extract reusable snapshot/read/answer/submit services accepting typed execution context; keep old routes/side effects identical; new route adapter owns campaign target lifecycle. |
| `backend/src/sm-visit.shared.ts`, `backend/src/sm-comment.shared.ts`, conditional-visibility helpers | Supported answer shapes, config bounds, comments, requiredness and logic. | Reuse validation for copied and changed answers; preserve all types/logic/OOS/points. No label-based cloning. |
| `backend/src/routes/sm-visits.ts:780–1066` (photo handlers) | File ownership tied to current draft/answer and physical storage cleanup. | New typed ownership/prefix, authorized inherited links, no removal of source object from follow-up discard/delete. |
| `src/components/sm/SmVisitWorkspace.tsx:296`, `:754`, `:1038`, `:1103` | Assignment-specific API calls throughout start/questions/photo/pause/review/submit. | Injectable typed visit adapter shared by old and new wrappers; new dedicated route and correct month context. Do not fork a second unsynchronized question renderer. |
| `src/app/(dashboard)/sm/marktbesuch/page.tsx`, `src/components/sm/SmPausedVisitNotice.tsx` | Assignment route requirement and assignment-only resume reference. | Preserve old route; add new route and discriminated notice references, owner/month/execution-aware resume/discard. |
| `src/lib/api/backend.ts:2200–2675`, `src/types/smVisit.ts`, `src/types/smSMDurcharbeit.ts` | Owner+assignment preloads/start tokens/pending mutations and mandatory assignment-shaped visit DTO. | New DTO/API namespace + shared normalized execution read model; queues keyed by context/month/execution, old queues not reinterpreted. |
| `src/components/dashboard/SmDashboardSchedule.tsx`, `src/lib/sm/SMDurcharbeitView.ts` | Date-ranged schedule/work date/duration; frozen scope takes precedence over registry fallback. | Keep standard/legacy schedule as is. New independent campaign list below calendar; new campaign identity comes from explicit context, no registry-based relabelling of history. |
| `src/app/(dashboard)/sm/page.tsx:11`, `src/components/dashboard/NachrichtenCard.tsx`, `src/components/ui/CollapsibleMenu.tsx:350` | Nachrichten after schedule; explicit mark-read; shared menu with duplicated SM definitions. | Opt-in SM Nachrichten panel/unread indicator; coordinated entry on all SM pages; preserve recipient/read/privacy/GM menu behavior. |
| `backend/src/routes/sm-management.ts:26`, `backend/src/sm-management.ts:71`, `:226`, `src/components/admin/sm/SmFbManagementWorkspace.tsx` | Nullable assignment works in list/detail; correction uses immutable snapshots; time editor requires assignment. | Campaign/month facets, monthly latest-state query vs all visits, new time-editor adapter. Campaign answer correction bumps monthly basis revision in same transaction; no historical template re-resolution. |
| `backend/src/routes/sm-dashboard.ts:118`, `:137`, `:298`, `backend/src/sm-dashboard.shared.ts`, `src/components/dashboard/SmDashboardHero.tsx` | Submitted/reporting-ready snapshots counted; no assignment join in visit metrics. Hero's planned-today count explicitly reads assignments. | New submitted snapshots naturally need qualified read-model inclusion; add separate monthly coverage metrics. Keep planned-today definition, existing OOS formulas and Standard/GM behavior; don't add all undated targets to today's denominator. |
| `backend/src/routes/sm-activity.ts:369`, `src/app/(dashboard)/sm/aktivitaet/page.tsx:1348`, `src/types/smActivity.ts` | Completed list inner-joins assignment; detail loads visit by assignment; change/delete APIs are submission-based. | Union/typed context for campaign completed visits, nullable planned duration, submission/execution detail adapter, correction/invalidation review updates monthly state and retained photo references. Preserve old activity routes and history. |
| `backend/src/routes/sm-planning.ts:388`, `:647`, `:957`, `:1579`, `src/lib/sm/timeView.ts`, employee/admin Zeiterfassung pages, `SmVisitTimeEditor` | Time list/current revisions/requests all assignment-based; totals assume positive planned minutes; day labels use planned work date. | Campaign actual-time reader/revision/request adapter; normalized row with no Soll, actual date, correct owner and exact visit ID. Sum actual/travel once per physical visit; all follow-ups included, no invented workweek/flat-rate/payroll rule. |
| `backend/src/sm-time-overlap.ts:29` | Overlap query requires assignment-time row and excludes assignment ID. | Shared two-domain reader and SM-level lock for both old/new writers; exclude exact submission/visit context, not null assignment rows. |
| `backend/src/routes/sm-photo-archive.ts:27`, `src/components/admin/sm/SmPhotoArchiveWorkspace.tsx`, `src/types/smPhotoArchive.ts`, `src/lib/exports/smPhotoArchiveExport.ts:9` | Nullable assignment left join; current submitted photo answers; signing by canonical file; ZIP manifest with original metadata. | Campaign/month/origin context, retained-link reader/signing, upload deduplication, proper authorization/limits and stale-owner protections; existing archive/ZIP behavior still works. |
| `src/lib/exports/smQuestionnaireExport.ts`, SM authoring workspace | Export is authoring catalog, not monthly visit result export. | Preserve existing export. Do not silently call it an answer export. Add a dedicated campaign result/roster workbook only when that output is implemented in this flow, with month/context and control totals. |
| `backend/src/sm-market-deactivation.ts`, `backend/src/routes/sm-markets.ts`, `backend/src/routes/admin-users.ts:894` | Existing market resolution previews dated assignments; SM account/anonymization touches market ownership and submission snapshots. | Include new campaign dependencies in approved resolution/account privacy flows; no auto-transfer/cancellation/waiver. Privacy operations cover new owner/name/audit references and retained files, without exposing old photos after a lawful removal. |
| `backend/src/routes/dsar.ts:255` | SM privacy inventory includes old market/assignment/submission/time/audit tables. | Add new campaign memberships, ownership revisions, visits, time requests/revisions and answer/file provenance to inventory/approved privacy handling. Discovery here uses code only; no DSAR execution. |
| `src/app/admin/layout.tsx:133`, admin navigation components | Segment-bounded separate questionnaire vs planning/market routes. | Campaign label/toolbar while retaining exact activation boundaries; no double highlight or changes to GM controls. |
| `backend/src/app.ts:175–195`, isolated fixture/router entry points | Separate role-protected SM routes; production entry point must stay separate from preview fixture/jobs. | Mount new admin + employee namespace with existing role checks/no-store semantics. Preview injected disposable DB/storage only; no new scheduled reset/materialization jobs. |
| `backend/src/lib/visit-answer-reuse.ts`, GM campaign tables/routes | GM has reusable answers but RED-month/calendar-quarter scope and GM ownership/market shape. | Borrow snapshot/provenance reasoning, not scope logic or GM data access; explicit SM calendar-month rules and separate tables. |

### New API contract sketch

Endpoint spelling is proposed; implementation should follow existing conventions consistently. Every new application DTO/type/helper uses the `SMDurcharbeit` name, and strict request validation rejects mixed/ambiguous contexts.

| Actor / operation | Suggested namespace / contract |
| --- | --- |
| Admin list/detail | `GET /admin/sm-smdurcharbeit-campaigns`, `GET /:id`; state/window/month summary/owner facets, revision, explicit legacy distinction. |
| Admin create/edit/preview/publish | Create draft; PATCH with expected revision; `POST /:id/publication-preview`; publish with preview token/expected revision/idempotency. Version/market/owner validation and all-month targets atomic. |
| Admin roster/waiver/extension | Preview + explicit scope/reason + expected campaign/target revision; append ownership/event history, add only new future obligations; protected drafts/visits listed. |
| Employee targets | `GET /sm/smdurcharbeit/targets?month=YYYY-MM-01&campaignId=…`; server determines authenticated person, own allowed history/future preview. Read does not generate/modify targets. |
| Pre-start context | `GET /sm/smdurcharbeit/targets/:id`; target availability, month/campaign/questionnaire revision and existing draft/latest visit. |
| Start/resume | `POST /sm/smdurcharbeit/targets/:id/start`; client token, expected target revision, timer/manual/travel input; returns immutable execution/submission context. Follow-up is explicit, not accidental GET side effect. |
| Visit read/actions | `/sm/smdurcharbeit/visits/:id` for GET/discard draft; PUT answers with expected answer version + mutation token; photo init/presign/commit/cleanup/unlink; PATCH timing; POST submit with idempotent receipt. All verify owner/context and draft state. |
| Management/activities/time | Extend read DTOs with discriminated legacy assignment vs campaign visit; keep existing routes backward compatible; add campaign-specific time revision/request route instead of fake assignment IDs. Answer/delete requests still anchor to submission IDs. |
| Monthly reporting | Explicit campaign + calendar month + owner/market filters; returns target eligibility, unique coverage, latest answer state and separate physical visit/time totals. No lifetime/RED interpretation. |

### Reporting definitions — avoid another ambiguous percentage

| Value | Definition |
| --- | --- |
| Required markets this month | Number of required targets in the campaign period, independent of displayed page/filter facets. Waived/unresolved targets shown separately, not silently hidden in totals. Publication requires owners for every required target. |
| Completed markets | Required targets with >=1 valid submitted physical visit in that period. Each target contributes at most one. A draft/started visit does not count. |
| Monthly coverage | Completed required targets / required targets. Empty denominator displays “Keine erforderlichen Märkte”, not an invented success percentage. |
| Visits and actual time | Every distinct valid physical submitted visit/time revision once, including follow-ups; no multiplication through question/file joins. Physical work date and business month both available. |
| Current monthly answers | One latest valid submitted snapshot per target. Question distributions count only applicable valid answered responses; group answer counts and percentage denominator are exposed. Follow-ups replace the target's monthly state, not add another market vote. |
| Existing dashboard answered-question count | Existing visit snapshot answer count retained. Prefilled answers remain answered in that snapshot; do not label all of them “newly answered”. A separate changed/newly-entered metric would use provenance/events and must not silently redefine the old count. |
| Existing OOS/score charts | Preserve current formulas and observation semantics. Add explicitly labelled monthly/latest-target view where needed; do not change Standard/GM exports, per-card filters or historic chart cohorts. |
| Export / archive date | Explicit business month, physical start/completion/submission dates and photo origin date, never one overloaded date column. Include stable campaign/target/visit/submission IDs, questionnaire version, eligibility and control totals. |

The current SM dashboard filters by submission timestamp, management/archive use a Vienna actual-start/work-date fallback, and employee activity currently displays planned work date. This redesign must make new campaign DTO date semantics explicit instead of assuming these three current definitions are interchangeable.

## 10. Implementation sequence and release boundaries

This is the original implementation sequence. Work is now in progress; §14 records what is implemented and verified. The full release boundaries and matrix still apply.

1. **Confirm bounded product choices, define contracts:** month-boundary/late-entry policy, current-draft reassignment, partial months, overlapping campaigns, optional Nachrichten move. Freeze the typed execution/context, reporting/date and photo-origin contracts. Use the recommended safe defaults in §7 unless the user deliberately changes them.
2. **Additive schema in disposable PostgreSQL:** new campaign/period/roster/target/execution/audit/time/provenance tables, two nullable submission links and partial indexes/constraints. No changes to old assignment constraints, template flags, primary keys, old files, history or rows. Use real migrations against isolated synthetic copies of the current schema; include RLS/grants, FK/unique checks and an exact no-backfill review.
3. **Backend domain services and compatibility adapters:** target publication/ownership/state; explicit campaign version/month selection; extract the existing visit engine with default legacy behavior; add start/answer/photo/submit adapters and shared two-domain time guard. Every operation has role/ownership, expected revision and idempotency contracts. Keep production job entry points uninvolved.
4. **Carry-over and provenance:** clone only compatible same-target/month submitted answer state into a new graph; canonical photo links; completion/latest-state revisions; correction/invalidation reconciliation; exhaustive isolated tests before any UI relies on this behavior.
5. **Admin campaign workspace:** registry/owner publication preview, month/SM coverage, protected changes/waivers/extension, questionnaire and market guards, reachable legacy dated view. New target generation is an explicit administrator publication action, not a GET/job/import side effect.
6. **Employee campaign flow:** independent home list, dedicated visit route, typed existing renderer, start/resume/follow-up/pause/receipt, stable completed-bottom ordering, owner/month-aware caches/offline conflicts. Add optional SM Nachrichten panel only once all SM navigation paths and read behavior work.
7. **All downstream consumers:** FB Management, Aktivitäten/change/deletion reviews, actual-time read/edit/request flow, overlap checks in both directions, home/admin metrics, photo archive/ZIP provenance, campaign result workbook if included, privacy/account/market/catalog dependency guards. Do not call the flow complete before these are integrated.
8. **Isolated E2E and regression sign-off:** complete matrix in §11, production-history synthetic sentinel comparison, migration/RLS/concurrency checks, frontend/backend builds and static checks; assess changes to shared renderers/menu separately.
9. **Separately authorized release:** present exact migration/code artifacts; apply only the reviewed additive DDL after explicit permission. Deploy compatible backend first, then frontend; keep new campaign starts gated until all readers, photo retention and time writers are ready. Feature gating cannot hide history once any new real visits exist. Metadata/deployment status can confirm delivery; no agent production smoke/data queries.
10. **Human activation:** user/admin reviews resolved existing registry rows and publishes the intended October–December campaign. No agent import, name-rematch, production target generation or historical conversion occurs merely because code ships. Agent verification remains disposable-only.

### History/cutover invariants

- Existing imported markets/registry IDs, source row/occurrence keys and duplicate-looking entries stay unchanged. Use them as FKs for the new roster; do not re-import the Excel as a deployment step.
- Every historical assignment, section/question snapshot, answer/event, file ID/path, start/end/time revision, submit receipt, correction/request and link keeps its identity and original domain. No campaign backfill, reclassification or `is_current` rewrite of old data.
- Existing dated Durcharbeit work does not become monthly completion automatically. Preserve access and show overlap warnings. If the business later wants historical recognition, that is a separate reviewed feature with synthetic validation and explicit data authorization, not a silent part of this rollout.
- Old frontend + new backend still supports old endpoints/DTOs, old auth/cache/queues and Standard/GM behavior. New frontend cannot start campaign work against an older backend; it shows unavailable state, not fallback creation of dated assignments.
- No startup/month-rollover scheduled write job. Human localhost:3000/4000 remains the normal app with human auth/editing available; agent fixtures/experiments stay independent 3037/4037 and use neither production config nor production connections.
- Existing authorized admin corrections and lawful privacy actions retain their normal approval/audit semantics. Preservation here means **no implicit alteration by the redesign/deployment**; it does not secretly disable the human's normal save/edit/delete capabilities.

### Rollback / operational failure

Pause new campaign starts through the feature/domain gate; preserve campaign reads/history and the new execution-aware consumers if any new visits were created. Keep additive tables/columns. Do not roll back to a frontend/backend that makes new visits invisible in activity/time/archive, and do not drop tables or revert schema to erase new records.

If a publication/start/submit transaction fails, show a retryable error and use the same idempotency token; no partial market completion or duplicate time. A storage upload failure leaves a recoverable draft, not a submitted visit without its required photo. External storage calls have bounded waits; do not hold a broad planning lock across a bulk file download.

## 11. Disposable verification matrix

**Full release checklist; not all cases are completed.** Concrete implemented coverage and remaining gaps are recorded in §14. The fixture architecture has PGlite, injected actual Express routes, `isolatedModule` rejecting unbound relative I/O, synthetic auth and synthetic photo storage. Disposable PostgreSQL is still needed for genuine concurrency/locking evidence. Frontend preview 3037 and backend 4037 load only synthetic settings. Tests fail closed on production `DATABASE_URL`, Supabase credentials or production mode; production modules/job entry points are not bound by the isolated loader. No production environment file, localhost:3000/4000 or deployed business endpoint is permitted for agent checks.

| Area | Required cases / assertions |
| --- | --- |
| Schema and no-history-change | Migrations apply to fresh and upgraded disposable current-schema DBs; old constraints unchanged; old rows remain null on new links; byte/content digests and IDs of synthetic historical Standard/legacy DA assignments/submissions/answers/files/times unchanged after migration, publication, month rollover and follow-ups. No insert/update/delete/backfill statement for historical tables except the explicitly required new nullable links on **new** campaign submissions. |
| Import/roster | All synthetic source rows incl. identical-looking occurrence pairs preserved; select registry IDs only; resolved exact active SM mapping; missing/ambiguous/inactive match cannot publish; renaming/re-import does not transfer current campaign ownership or rewrite visits. |
| Campaign publication | Three calendar periods/one target per selected market/month; fixed questionnaire version; partial-window preview; draft no employee visibility; atomic publish/idempotent retry; stale preview/version/owner change rejected; dates too long/invalid bounded. |
| Availability | Scheduled/current/ended/paused/archived; month selector; inactive employee/market/template; future and previous-month starts denied; read-only history remains. Account/market/catalog guards see new references. |
| Calendar rules | Oct->Nov->Dec, year boundary, leap February, Vienna DST changes, UTC/mobile timezone mismatch, actual month-window intersection, campaign extension within and across month, restart with no scheduler. No RED-period lookup. |
| First visit / idempotency | Own market start; other person's target/visit denied; one live draft; double tab/concurrent start only one execution; lost start response retry same receipt; GET no writes; reload/pause resumes exact graph/timing. |
| Questions and carry-over | All ten question types and every config/required/comment/conditional/subheading/scoring/OOS branch; empty/cleared source does not resurrect an older answer; options/matrix copied with new IDs; no cross-market/campaign/month/template leakage; next month empty; counts recalculated from applicable answered graph. |
| Follow-up | Explicit follow-up from submitted target; same month retained answers/photos; first visit unchanged/accessible; completed stays bottom and count one while follow-up draft open/discarded; repeated submissions do not count twice; submitted follow-up becomes monthly latest without suppressing first visit in physical history. |
| Corrections / invalidation | Source correction while draft open yields review conflict; approved correction bumps basis revision; latest invalidation falls back to prior valid state; only remaining visit invalidation reopens target; empty/no-applicable answers excluded from distribution; removal of time does not erase questionnaire completion unless separately invalidated. |
| Photos | Actual upload+commit+reload+submit+archive+ZIP; required-photo block; multiple and limits; original-photo carry-over references survive follow-up removal/discard and origin invalidation where retention is authorized; no historical path deletion; new upload cleanup ownership; foreign file injection denied; expiry/re-sign/error/retry; origin metadata and upload deduplication; privacy removal stops unauthorized access. |
| Times | Timer/manual/travel allowed current settings; each physical visit contributes once; no campaign Soll or invented flat rate; overlap standard->campaign, campaign->standard, campaign->campaign; touching endpoints permitted if existing rule does; concurrent submits/corrections lock correctly; exact-self exclusion only; approved requests retain revisions/author and correct actual date. |
| Reassignment / closures | Before first start; midmonth submitted; live draft protected; inactive employee; closed current-open/future market; reopen same month; denominator/event preview; completion not reset or double-counted; old author own-history preserved; future owner can access only authorized target/month retained state. |
| Concurrency and failures | Start vs reassign/waive/pause; simultaneous submit/correction; stale target/basis/answer revision; transaction rollback; storage timeout; lost submit response; no deadlock under documented lock order; clear conflict/recovery and retained draft. |
| Offline/cache/security | Owner logout/switch; delayed stale list/detail/photo/ZIP; October queued answer in November; version mismatch; same-tab/second-tab pending mutations; token isolation; cancelled/expired draft queue not replayed into a new execution; no secret in logs/artifacts; no arbitrary employee/date/context query. |
| Employee UI | White/minimal blue list below calendar, open/draft/completed sorting incl. follow-up; campaign/month/search; start/resume/manual time/questions/comments/photo/review/submit/receipt; navigation/back/refresh; no fake calendar entries; narrow mobile/touch/accessibility/reduced motion; loading/error/empty/stale accurate. |
| Nachrichten/menu | Same SM entry on Home/Aktivitäten/Zeit/Profil; badge/background fetch; bodies on open; explicit read preserved; retention visibility; no auto-read on menu open; recipient/owner boundaries; keyboard/focus/Escape/overlay coordination; GM/Kurti unchanged. |
| Admin and readers | Create/preview/publish/extend/pause/roster/waive; month+SM coverage; questionnaire/market dependencies; management details, activity, approved answer/time/delete requests, archive/ZIP/deep links, actual time lists and all visit receipts; zero-result/large-list pagination/facets and filter reset. |
| Reporting | Hand-calculated synthetic totals: 3 targets with 2 completed, one having 2 visits -> 2/3 coverage, 3 physical visits; monthly distribution uses latest target state, physical time sums all three; carried photo counted once as upload; waived/unresolved counts explicit; old Standard/GM formulas/filters unchanged. |
| Regression / scale | Existing SM Standard and legacy dated DA fixtures including central/override selection, frozen identity, old deep links, weekly planning/holiday behavior, manual authentication/save/edit/delete human mode; photo export/management/time/request suites. Large synthetic roster/history: first visible content before background details, no N+1/sign-all query, no out-of-order UI overwrite. |
| Privacy | New contexts appear in approved DSAR inventory; anonymization/retention handles owner/name/provenance fields; retained file access respects lawful withdrawal; no raw personal production rows used in tests. |

Do not settle for mocks alone: one complete browser -> actual isolated API -> isolated DB/storage -> receipt -> management/activity/time/archive/ZIP journey must include a first visit, follow-up, next-month empty start, reassignment and a correction. Keep fixtures and network allowlists separate from production modules. Review the migration artifact and new/current API contracts independently before release.

## 12. Risk verdict and decisions to review

**Verdict:** feasible and clean as an additive domain. It is a substantial lifecycle change, not a quick front-end toggle. The existing questionnaire snapshot/validation machinery is reusable, but the existing dated assignment domain is not an appropriate source of truth for undated monthly campaigns.

| Risk | Assessment / containment |
| --- | --- |
| Historical corruption/orphans | High consequence; low intended exposure with additive schema/no backfill/no relabelling/FK restriction and synthetic sentinel comparisons. Any automatic legacy conversion would raise this materially and is excluded. |
| Wrong monthly counts / carry-over | High implementation sensitivity; stable campaign-market-month key, separate physical execution vs monthly state, provenance and same-month-only tests. |
| Photo deletion/access | High consequence; canonical retained links, ownership-aware cleanup, archive/sign/privacy integration are release gates, not optional later polish. |
| Actual-time invisibility/overlap | High consequence; activity/time assignment joins and shared overlap reader require explicit adapters in both directions. No fake Soll. |
| Reassignment / late entries | Medium–high business ambiguity; versioned ownership/current-draft protection and explicit proposed boundary policy. Review before coding those transitions. |
| Shared renderer/menu regressions | Medium; typed adapters/SM opt-in extension, old DTO/routes retained, old SM/GM fixture and keyboard/touch regression coverage. |
| Publication/rollover performance | Medium; bounded atomic publication, indexed target queries, no write jobs on page load or month change, no full graph/photos per list row. |
| Schema deployment locks | Operational risk still exists even for nullable additive DDL/indexes. Review exact artifact and lock timing, test upgraded schema, seek specific authorization later; do not claim a risk-free migration. |

Recommended decisions to confirm before implementation:

1. **Late-month draft policy:** proposed locked/read-recoverable after closing until an explicit admin exception. Doris confirmed calendar months, not grace/late-entry handling.
2. **Mid-draft reassignment:** proposed block automatic transfer; resolve/cancel with audit first. Submitted monthly completion stays with the target.
3. **Partial months:** proposed one required visit in the campaign/month intersection; no proration.
4. **Overlap:** proposed explicit admin confirmation for independent same-market/month campaigns; no merged answer state.
5. **Questionnaire changes:** proposed pinned campaign version, explicit future-unstarted month edits only.
6. **Nachrichten:** recommended move into an SM-only Home menu panel alongside Kurti. This is the user's suggested placement, not a requirement to redesign GM.

These are product edge decisions; they do not prevent finishing the source audit/plan. No additional production permission is being requested in this document. Future implementation, database changes, activation and release are separate work.

## 13. Requirement coverage and completion audit

| Requirement | Plan coverage |
| --- | --- |
| R1 multi-month campaign | §6 campaigns/periods, §7 availability/extension, §8 admin workspace. |
| R2 owner only/no day/time | §6 target identity, §7 publication/authorization, §8 undated employee list; existing planned-time constraints preserved. |
| R3 Excel assignee | §3/§9 import evidence, §7 exact resolved active-user mapping/unresolved preview. |
| R4 stable roster with exceptions | §7 scoped assignment revisions/waivers/reopening, §10 cutover. |
| R5 once per normal month | §6 period/target uniqueness, §7 server calendar month/submit, §9 metric definitions, §11 verification. |
| R6 same-month answers / next-month empty | §7 fresh graph + provenance + compatible carry-over, §11 all-type/month cases. |
| R7 stable questionnaire | §6 pinned versions, §7 frozen graphs/future-only changes, §9 catalog guards. |
| R8 employee entry and ordering | §8 list/route/primary actions, §7 pause/cache/offline, §11 mobile/browser flow. |
| R9 management / answers / photos | §8 admin, §9 full dependency matrix/APIs, §10 reader gate, §11 actual-time/archive/activity journey. |
| R10 optional Nachrichten move | §8 SM-only panel/read semantics and menu coordination, §12 review decision. |
| R11 history and production safety | §2 boundary, §6 constraints, §10 no-backfill cutover/rollback, §11 synthetic sentinels. |

Original planning-stage audit: at that point this document was the sole new artifact; no implementation or test pass was claimed. The subsequent end-to-end implementation is now in progress. Use §14 for present evidence; the original planning-stage audit is not a statement about the current working tree.

Continue updating this document during any later implementation with resolved product choices, concrete schema/API artifacts, verification results and release evidence. Do not replace the distinction between observed current code and proposed behavior with assumed completion.

## 14. Implementation and evidence ledger — 2026-10-09

The local R1–R11 implementation is complete with the explicit policy boundaries in §15. Work is unpushed in the managed `codex/sm-durcharbeit-einsatz` checkout. No production connection, migration, import, target publication, data operation or scheduled write job has been used. `backend/supabase/migrations/20261009100850_SMDurcharbeit_monthly_campaigns.sql` and `20261009133000_SMDurcharbeit_context_integrity.sql` are additive **source artifacts**, applied only to disposable synthetic PGlite and native PostgreSQL fixtures. The latter adds new-domain identity/context/duration constraints without a row update or backfill. The table below records the earlier checkpoints; the final closure evidence is in §15.

| Requirement / boundary | Earlier checkpoint evidence | Follow-up at that checkpoint (closure in §15) |
| --- | --- | --- |
| R1–R5 campaign, roster, ownership, calendar targets | Actual campaign routes, publication preview, stable registry/user IDs, pinned monthly periods/targets, roster changes, waiver/reopen/state/extension services and admin workspace exist. Synthetic publication/start tests exercise the real handlers. | Full transition and concurrency matrix; dependency guards for registry, account and market changes; large-roster behavior. |
| R6 answers and photo carry-over | The shared answer engine serves a separate typed campaign execution namespace. A follow-up receives fresh answer/snapshot IDs with same-month provenance; next-month start is empty. All supported answer families, explicit clears, owned uploads, retained-photo unlink/discard and invalidation fallback pass actual-route tests. Visible carry-over/original upload labels, resume, discard and a new follow-up submission are proven in the recovered browser. Explicit synthetic privacy withdrawal denies inherited signing, archive, report and future carry-over access while preserving stored historical answers. | Full browser new-file upload/ZIP/next-month journey and broader privacy inventory. |
| R7 frozen questionnaire versions | Visits retain their snapshots. Campaign periods pin versions and future unstarted-period changes have their own service. Catalog deletion checks include campaign references. | Complete future-version/deactivation/stale preview coverage and historical sentinel audit. |
| R8 employee home/start/resume | Minimal white/blue list below the calendar, open/completed ordering, independent loader, campaign/search controls, typed pre-start/start/resume route, pause notice, owner changes, online/focus/visibility/Vienna month-rollover refresh and stale-error preservation exist. Month navigation exposes only owned periods, keeps future work closed, and replaces old-month actions/counts with loading until the requested month resolves. Own completed history remains reachable after closure; another author's visit is not a direct history link. Actual-route tests prove period/target reads create no drafts or revisions. | Browser month-selection/mobile/keyboard proof, full offline/account-switch/photo export race coverage and reviewed closed-month recovery. |
| R9 actual time | Separate campaign time list/correction/request/review endpoints are mounted in app and isolated fixtures. Current time is an append-only revision; original questionnaire timestamps and answers stay frozen. Standard and campaign overlap writers share the person lock and read canonical time; questionnaire invalidation does not erase worked time. Admin/employee time views and profile actual totals include physical visits without adding Soll. Lazy original/revision history is implemented in employee/admin time and management views; employee browser proof exists. Native PostgreSQL simultaneous dated/monthly submissions and corrections pass. Monthly export includes current times and original receipt stamps. | Full admin history browser proof and all remaining time/export regression consumers. |
| R9 shared admin requests | `/admin/sm-activity/requests` merges campaign time requests with the dated request feed. Each request reads its immutable source revision and keeps a typed `SMDurcharbeitVisitId`; the SM request flap dispatches approval/rejection to the campaign namespace. Account-switch response guards clear SM request/time state. | Browser creation, approval/rejection and stale-request recovery proof; complete delayed review/session race checks. |
| R9 management/activity/archive | Submitted physical visits remain visible; campaign/business-month management filters and context are added. Canonical corrected time is read by management/activity; retained photo archive deduplicates physical uploads and adds origin/campaign/month to ZIP metadata. Archive campaign/month controls and original upload details are implemented. Lazy monthly results and Excel report use a single read-only repeatable-read snapshot: latest answers once per required target, each physical time once, explicit waived/unanswered counts and deduplicated original photos. Actual-route and serialized-workbook control totals pass. | Browser archive/report controls and downloads; full correction/readers/export journey and scale bounds. |
| R10 Nachrichten | SM Home, Aktivitäten, Zeiterfassung and Profil use an opt-in Home-menu inbox alongside Kurti. The dashboard message card is replaced by that reachable entry. Closed menus fetch only an unread aggregate; body pages mount on open. Actual recipient/role-authorized inbox routes paginate unread-first with stable timestamp/ID ordering and preserve legacy GET ordering. Read remains an explicit button action; original receipts, NULL retention and timed/one-time visibility remain unchanged. SM panels include loading/retry/empty, back/Escape/focus handling and account-owned request generations. Browser opening did not mark messages read; explicit read removed a one-time message and retained the timed message. All four SM entries and back-focus/layout are proven. GM does not opt in or fetch the SM inbox. | Actual keyboard/Escape/touch/reduced-motion checks and GM/Kurti regression proof. |
| R11 history/safety | Synthetic golden snapshot assertions cover source answers/sections/options/matrix/files/events/timestamps after follow-up, time corrections and time deletion. No fake dated assignment or positive Soll is created for monthly visits; legacy management regression routes pass. | Full historical migration sentinel coverage, privacy inventory, schema audit and complete old SM/GM regression gates. |

Current command evidence:

- Backend: isolated actual-route `SMDurcharbeit-monthly.integration.test.ts`, `sm-management.integration.test.ts`, `sm-time-overlap.test.ts`: **37 tests passed, 0 failed**. Monthly tests include time corrections, revision conflicts, request feed source preservation, replay, overlaps in both directions, interval/month bounds, time-only deletion, and completion/history invariants.
- Frontend: `sm-time-view.test.ts` and `sm-visit-time-correction.test.ts`: **9 tests passed, 0 failed**. Hand-calculated mixed/campaign-only actual totals, null Soll/no invented planned days, legacy totals, and Vienna DST input conversions are covered.
- Frontend and backend TypeScript checks completed with exit 0 after the time/request-feed changes. This is compilation evidence, not complete browser/concurrency evidence.
- Independent backend 4037 was deliberately restarted after source changes using `tests/SMDurcharbeit-preview.ts`; it reports disposable PGlite and uses synthetic storage/auth. The human 3000/4000 processes were untouched.
- Browser preview confirms the monthly campaign toolbar excludes dated weekly controls and catalog creation actions. The centered extension dialog uses the existing calendar inside its modal; January navigation/date selection and cancellation work. Remaining browser readers/review proof is ongoing.
- Additional actual-route monthly navigation test: the focused monthly suite now has **14 passing tests**. A foreign January–February roster is invisible; strict query input rejects employee overrides; future-start rejection leaves target, visit, owner and submission graphs unchanged.
- Inbox verification: real isolated message migrations and actual Express routes are now included in the fixture/preview. Monthly + inbox integration + retention suites: **24 passed, 0 failed**. Covered count-only response, no GET writes, role/recipient denial, explicit read/idempotent timestamp, one-time removal, retained/expired/deleted/NULL-policy rows, 137 unread messages plus two retained messages through stable cursor pages with no duplicates.
- Client session verification: message/campaign session-race + existing GM cache + SM actual-time/Vienna input suites: **17 passed, 0 failed**. Delayed bodies/counts, A→B→A, late 401 and already-running refresh cannot leak old results, replay a read/start against the new account or restore the previous account. Same-owner token renewal and explicit-read badge notification still work.
- The request transport now accepts an opt-in owner guard before initial send, before/after refresh, before retry and before returning data. The SM inbox and monthly campaign adapter use it; callers that do not opt in retain their old behavior. The private API owner-key helper is now exported for consistent SM menu/panel reset behavior.
- Frontend and backend TypeScript checks passed after the inbox UI/API changes; the subsequent small accessibility refinement still needs the current final check below. The independent preview was deliberately restarted after source changes, with actual synthetic messages and their real receipt routes; no normal human localhost server was touched.
- Browser continuation encountered a policy rejection when reloading an old internal error page. The user reopened a normal HTTP preview tab and confirmed it. That allowed the documented browser runtime to resume; no policy bypass or private session inspection was used.
- Earlier admin actual-time browser correction proof is saved in `outputs/SMDurcharbeit-monthly-proof/admin-time-correction.jpg`: first visit 10:00–10:15, 15 minutes, Version 2, aggregate 1h55m, no campaign Soll. This proves the prior synthetic preview run, not the newly restarted fixture or current inbox UI.

Subsequent evidence:

- Native PostgreSQL 16 runs in a separately marked, temporary Unix-socket cluster on 55437, with unique disposable databases and synthetic credentials. No production URL or environment file is loaded. The application dependency directories were not changed. Publication/start/submit/correction concurrency, cross-context constraints, RLS/privileges, monthly lifecycle and photo privacy withdrawal: **23 passed, 0 failed**.
- After the report integration, native monthly/report/withdrawal suites: **16 passed, 0 failed**. Report control fixture: three targets, two completed, one follow-up gives 2/3 coverage and three physical visits; latest Ja/Nein is 50/50, numeric zero remains answered, missing text is counted unanswered, multi-select can total 200%, next month is empty, and waiving an open market gives 2/2. GETs preserve the original graphs byte-for-byte. Carried photos count as one upload; withdrawal leaves no available report reference.
- Frontend serialized workbook, transport/session guard, time reader and photo ZIP suites: **26 passed, 0 failed**. Excel control totals match source objects, preserves source provenance/original times, and user text is serialized as string cells without formula injection.
- Frontend and backend TypeScript checks passed after report source additions. The isolated module fixture explicitly injects the report helper; it cannot import a production environment/database module.
- Browser synthetic follow-up: pause/reload/resume, inherited answers and original photo labels, unlink/discard without changing completion, new follow-up submission and receipt. Employee profile and actual-time views total two hours with five hours of dated Soll unchanged. Expanded history distinguishes original visit times and current Version 1.
- Proof files are in `outputs/SMDurcharbeit-monthly-proof/`: `sm-inbox.jpg`, `admin-time-approved-request.jpg`, `sm-follow-up-prefill.jpg`, `sm-follow-up-photo-origin.jpg`, `sm-follow-up-receipt.jpg`, `sm-profile-monthly-actual.jpg`, `sm-time-history.jpg`. These are synthetic preview runs; restarting the fixture resets those rows and does not invalidate the labeled prior evidence.

The early partial results above have been superseded by the final local verification in §15. Production release readiness still requires review and specific authorization of the exact additive migration artifacts and a deployment; no production operation was used to establish local correctness.

## 15. Local completion audit — 2026-10-09

The requested local build is complete. The independent frontend remains on `http://127.0.0.1:3037`, with the disposable synthetic backend on `http://127.0.0.1:4037`. The backend's controlled next-month clock was used only for the rollover browser proof and then removed by restarting the synthetic fixture. The final preview uses the current calendar month. The human production-connected 3000/4000 application and original checkout were untouched.

| Requirement | Final local evidence |
| --- | --- |
| R1–R5 campaigns, imported roster and calendar-month ownership | Real handlers cover draft/publication, unresolved assignments, stale previews, explicit overlapping obligations, registry-only market membership, pause/resume, extend/archive, waiver/reopen and current/future ownership changes. Imported stable market IDs and every duplicate-looking registry row remain distinct. Registry metadata changes do not transfer a published campaign's owner. Inactive users/markets cannot start work; their existing obligations/history are not silently deleted. Native races cover publication/start/submit, ownership/state changes, and standard/monthly actual-time overlaps. |
| R6 monthly answers and photos | Same-month follow-up preserves all supported answer families and retained-photo provenance using fresh graph IDs; next month starts with zero answered questions and no inherited photos. Browser proof includes actual file selection/upload, pause/reload/resume, retained photo origin, unlink/discard, submission/receipt, archive filtering and a successful originals ZIP. Privacy withdrawal blocks signing, archive/report access and future carry-over without rewriting the stored source graph. |
| R7 questionnaire identity | Current period/version and existing snapshots stay pinned. Future-only version changes, catalog deletion/deactivation guards and stale revision/preview rejection pass. Golden historical rows remain unchanged after migrations and new operations. |
| R8 employee flow | Owned undated targets are separate from the normal week calendar, ordered open before completed, with month/campaign/search controls and start/resume/follow-up/history. Closed October targets cannot start new November work; an already submitted October receipt remains readable. Admin can explicitly cancel a blocked unsubmitted draft with a reason and audit, preserving prior submitted visits. Owner-scoped paused notices reject another account's or unowned legacy metadata. Actual mobile 390×844 browser checks caught and fixed missing dropdown styles and shrinking inbox slides; the final monthly controls and message text fit without page overflow. |
| R9 management, actual time and reporting | Browser proof covers answers/photo history, original upload identity, campaign/month archive filters, originals ZIP, monthly coverage/latest answers versus physical visit count/time, employee profile/time, and admin time correction/review. Actual-route tests cover append-only time revisions, stale requests, time-only deletion, reader/export control totals and canonical original-photo deduplication. Campaign history loads on demand with action, reason, actor and Vienna timestamp; strict stable cursor pagination reads 137 tied-timestamp synthetic events without duplication or mutation. |
| R10 messages and shared menu | SM-only unread aggregate/background loading and lazily mounted message bodies preserve explicit read/retention rules. Account-change transport guards reject delayed reads, refreshes and mutations. Browser checks cover keyboard open, tab/focus, Escape/back, mobile panel and unchanged unread count on open/close. Reduced-motion CSS is scoped to the new SM menu/controls; it was reviewed in source, not emulated in the browser. The original GM menu and Kurti panel still open without an SM inbox; the limited synthetic GM fixture does not serve the unrelated GM dashboard/Kurti backend, so those endpoint error states are not claimed as a full GM service test. Existing GM dashboard rendering/filter/cache regressions pass. |
| R11 historical data and isolation | Native upgraded-schema sentinels preserve existing dated assignments, IDs, answer/options/matrix/file/event graphs and timestamps. New monthly executions create no dated assignment, planned day or positive Soll. New-domain FK/context/immutable identity/duration constraints and RLS/privileges are tested on disposable PostgreSQL. Read-only privacy inventory adds aggregate counts to the existing DSAR tooling. No historical conversion, production query, cleanup, backfill, scheduled write job or release occurred. |

Final verification results (counts are per run, not additive claims about unique tests):

- Native PostgreSQL 16 full route/regression run: **96 passed, 0 failed, 0 skipped**. Monthly lifecycle, concurrency, transition/dependency cases, migration history, reporting, privacy withdrawal, dated Einsatz/import/management/photo archive/time/message regressions passed.
- Maximum roster/period test: **1 passed**, 5,000 markets, first 15,000 targets and extension to 120,000 across 24 months. Original-month identities remained unchanged. 5,001 markets and 25 months are rejected before publication. The approximately 48-second synthetic run is fixture timing, not a production performance guarantee.
- Latest frontend run: **62 passed, 0 failed**. Serialized XLSX/ZIP control totals, text-cell safety, export/account races, inbox/campaign transport, paused-notice ownership, actual-time/Vienna DST conversions, and original GM chart/filter/cache behavior passed.
- Existing backend pure regressions: **50 passed** for answer/time/OOS/privacy/profile/planning/user/home behavior, using synthetic/stubbed dependencies and no production settings.
- Frontend/backend TypeScript checks passed. Scoped lint of all eight new or substantially changed campaign/SM view components passed. Both repositories' `git diff --check` passed.
- A transient Supertest keep-alive reset was confined to ephemeral test servers. The fixture now explicitly closes its test connections; the complete native run then passed. Production transport, retry logic and entry points were not changed to mask it.

Browser proofs are under `outputs/SMDurcharbeit-monthly-proof/`. They come from explicitly synthetic fixture runs; restarting the preview resets synthetic rows. Key final additions: `admin-campaign-history.jpg`, `admin-draft-cancel-reason.jpg`, `admin-draft-cancel-preserved-history.jpg`, `sm-reassigned-photo-origin.jpg`, `sm-next-month-empty.jpg`, `sm-next-month-empty-photo.jpg`, `sm-closed-month-receipt.jpg`, `sm-mobile-monthly.jpg`, `sm-mobile-inbox.jpg`, and `gm-menu-regression.jpg`. Earlier actual upload/report/archive/time proofs remain labeled in §14.

### Policies and production handoff

- Closing a month locks ordinary new work and submission for that month. Existing drafts are readable/recoverable and an admin can explicitly cancel one with audit. A late-entry grace window or approval exception is **not implemented or assumed**; it would need its own agreed policy and audited workflow.
- A changed monthly answer basis rejects stale publication rather than silently merging or overwriting a draft. Review/recovery or explicit draft cancellation/restart is required. Immediate ownership transfer is blocked while a live draft remains protected.
- One obligation is required for each included calendar-month intersection, without proration. Overlapping campaigns remain independent only after explicit confirmation. Limits are 5,000 markets and 24 months per campaign; normal lists reveal further rows in bounded batches rather than silently truncating totals.
- New privacy inventory/withdrawal checks preserve data and access boundaries. No new automatic retention/anonymization/purge job for historical campaign/time/photo records was authorized or added; reviewed DSAR handling remains an operational requirement.
- The two additive migration artifacts have **not** been applied to production. No production import, activation, backfill, push or deployment is authorized by this local-only completion. Production schema lock timing and real workload performance remain deployment review items.

## 16. Employee UI refinement — 2026-10-09

Home now shows a compact current-month Durcharbeit link in the menu dock, always above Home. The full monthly target list moves to `/sm/durcharbeit`; its month/campaign/search, bounded additional rows, start/resume/follow-up/history and unavailable-state rules remain intact. Home and the full page reuse owner-scoped monthly fetching and the existing SM menu. The dock reserves content space and its inbox respects the additional height on small screens.

The recent monthly start, time/history, inherited-photo labels, campaign workspace/report/history and inbox views received a focused readability and spacing pass. Existing GM UI and backend behavior remain unchanged. Research, decisions and local evidence are recorded in [sm-SMDurcharbeit-ui-review.md](sm-SMDurcharbeit-ui-review.md). The pass introduced no backend/schema or production operations. TypeScript, scoped lint, 21 behavior/transport/time tests and 17 existing SM dashboard checks passed, with synthetic browser proof across employee mobile and admin desktop layouts.
