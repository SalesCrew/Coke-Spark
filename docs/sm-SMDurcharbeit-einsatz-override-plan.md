# SM Durcharbeit: per-Einsatz questionnaire override and complete visit handling

Date: 2026-10-07

Status: implemented and verified locally after the user authorized building it; no production connection, production migration, commit, or push. See [implementation and verification](sm-SMDurcharbeit-einsatz-living.md).
The assessment below records the original pre-implementation inspection and design. Production behavior and production records were not inspected.

## Verdict

SM Durcharbeit is **not yet handled throughout the assignment and reporting lifecycle**. The local draft provides a separate blue Durcharbeit authoring workspace with the standard module/question editors and settings. It does not yet provide a reliable per-Einsatz override, a questionnaire-type indicator through the employee visit flow, or a type distinction in SM reporting.

This can be a clean additive change, with **medium overall implementation risk**. The important boundary is the transition from a planned Einsatz to its frozen submission. A frontend-only dropdown or reusing the existing resolved questionnaire-version field would be unsafe: the current visit-start resolver puts the central questionnaire first and overwrites that field.

The recommended design is one explicit optional override on the existing Einsatz, one authoritative resolution rule, and the existing submission/snapshot/answer engine. No new campaign engine, duplicate visit, answer migration, or GM behavior change is needed.

## Mandatory historical-data invariant

The user's additional requirement is a release blocker: **all existing historical data must stay exactly as it is**.

- No historical backfill, conversion, relabeling of stored records, recalculation, cleanup, or repair job as part of this feature.
- Preserve every existing ID, foreign-key link, questionnaire/module/question/answer snapshot, photo/storage reference, revision, audit event, date, timestamp, time entry, and stored count/value.
- The additive override column starts null on existing assignments. Do not infer overrides from old questionnaire-version bindings or populate them automatically.
- The new override path must never relink an already-started or finished visit, modify its answers, or regenerate its snapshot graph. Earlier revisions and discarded historical submissions remain intact too.
- Historical type display comes only from the submission's existing immutable questionnaire identity. Today's central selection or assignment override must never reclassify a past visit.
- With the same historical dataset and existing filters, existing dashboard totals, OOS values, and existing export rows/cells must remain the same. New metadata or an explicitly selected new type filter may add a view, but must not silently change the old view's population or formulas.
- Preserve existing explicit human correction/discard workflows and permissions; this feature neither invokes them nor adds a route for changing historical data.

Prove this on synthetic legacy history in the isolated environment: compare all pre-existing column values and references before/after the additive migration and representative new-feature operations, and compare historical API/report/export results under unchanged filters. Any unexplained difference blocks release. Never use production records or connections for this verification.

## 1. What the existing code actually does

| Area | Current source behavior | Gap |
| --- | --- | --- |
| Authoring | Separate standard and `SMDurcharbeit` catalogs; immutable `smdurcharbeit_` stable-code namespace; blue Durcharbeit editors reuse all standard question settings. | This draft remains local. Other consumers need the catalog identity. |
| Default assignment | SM Verplanung has one current central questionnaire template. Its effective published version is resolved for the work date. | There is no separate per-market questionnaire default to override. |
| Einsatz editing | Drawer changes market, SM, date, and minutes. No questionnaire selector. Changes can be saved through several sequential API calls. | Per-Einsatz selection, atomic validation against the final edited state, and audit data are missing. |
| Visit preview | Before start, GET resolves the global selection first and returns questionnaire names/count only. | No override priority or selected type/version/source identity. |
| Visit start | `resolveQuestionnaireVersion` in `sm-visits.ts` selects the central questionnaire before `smAssignments.questionnaireVersionId` and can rewrite the latter. | Existing version ID is a resolved binding, not proof of an explicit admin choice. |
| Started visit | Current submission stores template/version links and snapshots modules, questions, options, logic, OOS settings, and names. | Preserve this engine and add type display; never swap its questionnaire. |
| Employee dashboard | Schedule maps assignments into a smaller display model; the mapping drops questionnaire metadata. Visit payloads are prefetched/cached. | No reliable planned Durcharbeit label; stale previews need handling. |
| Admin dashboard | Current submitted visits and applicable OOS answers feed the existing metrics. No questionnaire-type filter. | Add type distinction without changing OOS meaning or counting a visit twice. |
| FB Management / history | Questionnaire name/version already shown from submissions; correction workflows operate on snapshots. | Add stable type identity to rows, detail, activity, and request metadata. |
| Deactivation/deletion | Questionnaire guards check the current central assignment. | Explicit pending overrides also need protection; a foreign key alone does not prevent soft deletion. |

Key source anchors:
- [Visit resolver and global-first precedence](</Users/kiliansternath/.codex/worktrees/market-chain-multifilter/Coke Spark/backend/src/routes/sm-visits.ts:252>).
- [Pre-start preview](</Users/kiliansternath/.codex/worktrees/market-chain-multifilter/Coke Spark/backend/src/routes/sm-visits.ts:440>).
- [Start transaction and snapshot creation](</Users/kiliansternath/.codex/worktrees/market-chain-multifilter/Coke Spark/backend/src/routes/sm-visits.ts:745>).
- [Planning schema, list metadata, and mutation endpoints](</Users/kiliansternath/.codex/worktrees/market-chain-multifilter/Coke Spark/backend/src/routes/sm-planning.ts>).
- [Current editing drawer](</Users/kiliansternath/.codex/worktrees/market-chain-multifilter/Coke Spark/src/components/admin/sm/SmVerplanungWorkspace.tsx:212>) and [sequential persistence](</Users/kiliansternath/.codex/worktrees/market-chain-multifilter/Coke Spark/src/components/admin/sm/SmVerplanungWorkspace.tsx:790>).
- [Assignment schema](</Users/kiliansternath/.codex/worktrees/market-chain-multifilter/Coke Spark/backend/src/lib/schema.ts:964>).
- [Existing catalog draft](</Users/kiliansternath/.codex/worktrees/market-chain-multifilter/Coke Spark/docs/sm-SMDurcharbeit-catalog-living.md>).

## 2. Required behavior

Editing one **unstarted** Einsatz gets a field called **Fragebogen**, using the existing searchable admin dropdown and normal buttons/spacing.

Options:
- **Zentralen Fragebogen verwenden**: remove an explicit override and return to the current default resolution.
- Each eligible published standard or Durcharbeit questionnaire, with its name, version, and type. Durcharbeit uses the existing blue identity.
- Current pinned selections remain visible with an explanation if they become unavailable; do not silently replace them or erase the field.

Show the effective central questionnaire beside the default option, and a short helper for an explicit choice: **Gilt nur für diesen Einsatz. Ersetzt den zentralen Fragebogen.**

The selected questionnaire completely replaces the default for that visit. It is not appended as a second questionnaire. Selecting a standard questionnaire explicitly is also supported.

Before saving, options are loaded in the background and filtered for the final work date. Server validation remains authoritative. Do not download the entire authoring catalog merely to populate this picker. Keep loading, errors, keyboard selection, and selected state inside the existing drawer UI.

The type must be visible:
1. In Verplanung on the assignment and its edit/detail drawer.
2. On the SM dashboard assignment card and detail dialog.
3. On the visit start screen, during the questionnaire, and when resuming/viewing completion.
4. In admin SM dashboard reporting/filter context.
5. In SM FB Management, historical activity, and existing answer-change/deletion-request details.

Only add the questionnaire label/badge where relevant. Keep unrelated layout, GM screens, timers, and question controls unchanged.

## 3. Authoritative selection and persistence

Priority:

```text
Existing current submission -> its original frozen questionnaire
Otherwise explicit per-Einsatz override -> its selected published version
Otherwise -> current central/default and existing legacy resolution
```

### Explicit override

Add one nullable published-version foreign key to `sm_assignments`:

- Code/API name: `SMDurcharbeitQuestionnaireOverrideVersionId`.
- SQL name: `smdurcharbeit_questionnaire_override_version_id`.
- References `sm_questionnaire_versions.id`, with `ON DELETE RESTRICT`.
- Null means default resolution. Omitted in PATCH means leave unchanged; explicit null means reset. Validate this distinction in strict request schemas.
- New feature helpers, fields, constraints, and error keys carry the `SMDurcharbeit` / `smdurcharbeit_` namespace, following the user's naming requirement and the existing lowercase SQL/stable-code convention.

Keep the existing `questionnaire_version_id` and all existing identifiers. Do not reinterpret existing non-null values as explicit overrides, and do not backfill or clear them.

Pin the override to the **published version selected by the admin**. Publishing a newer version must not silently change that Einsatz. The dropdown makes the version visible; reselecting a newer version is explicit. This is the main product tradeoff: predictable content rather than automatic upgrades. Assignments without overrides retain current default-version behavior.

Derive Standard/Durcharbeit from the immutable referenced template stable code through the existing classifier. Do not infer it from the display name. Historical joins must include archived/soft-deleted template roots because history is still valid. Existing template/version foreign keys and immutable scope make a second type-snapshot column unnecessary for this feature.

Expose one consistently shaped `SMDurcharbeitQuestionnaireSelection` descriptor in relevant payloads: template ID, version ID/number, name, catalog type, selection source, and availability/block reason. For started visits derive it from the submission; for unstarted visits derive it from the shared resolver. Do not trust an authoritative questionnaire selection supplied in a URL.

### Resolver and snapshot boundary

Extract a shared, read-only selection function for planning lists, preview, and start. Persist the resolved legacy binding only inside the existing start transaction. GET previews must not modify assignments.

An invalid explicit choice is a visible blocking problem, never a fallback to another questionnaire. Validate active/nondeleted template, published/nondeleted version, date validity, and usable question graph. Keep existing market ownership, SM authorization, logic, and once-per-market rules. Selection should not bypass question-level applicability.

Once a current submission exists, the selector is read-only. Enforce this on the server by checking the submission, not just the assignment's status. Repeated start/resume returns the same graph. No automatic discard, deletion, answer copying, or switch to a newer questionnaire. Existing explicit human discard/correction workflows retain their own rules.

### Atomic edit and races

Current edits can PATCH market/minutes, then reschedule, then reassign. Adding a date-sensitive override to that sequence could partially save or validate against the wrong date.

Implement a scoped atomic **single-occurrence edit** command for the final market, SM, date, minutes, and optional override. Reuse existing validators, holiday adjustment, audit events, ownership rules, and planning locks; keep existing endpoint contracts compatible. Validate the effective date after any holiday adjustment before committing. A failure leaves every field unchanged.

Keep series-wide reassignment a separate, clearly scoped operation; the questionnaire override always belongs to the clicked Einsatz. Do not display one unconditional success if a mixed-scope operation partly failed.

Use `expectedUpdatedAt` for conflicting edits. Coordinate start, override edits, current-default changes, publishing/status changes, and soft-delete dependency checks with a documented consistent lock order. Current start already uses the visit advisory lock and planning lock; catalog/global operations use other advisory locks. Extend them deliberately and test simultaneous operations for deadlocks and consistent outcomes.

Before start, send an expected effective questionnaire version/revision from the preview. If the effective selection changed, refresh and show the updated questionnaire instead of starting different content invisibly. Returning an already existing submission must remain idempotent.

Record override before/after, actor, and resolved questionnaire identity in the existing assignment audit event structure. No separate audit table is needed.

## 4. Assignment lifecycle and catalog safeguards

| Event | Rule |
| --- | --- |
| Change central questionnaire | Only default-following unstarted visits change. Explicit overrides and started submissions stay fixed. Adjust the existing success wording that currently says all unstarted Einsätze change. |
| Change SM | Preserve the override on the same assignment; preserve ownership checks. |
| Move date / holiday adjustment | Preserve the selection; validate the pinned version for the final date. If invalid, reject the edit with a clear explanation. A system-driven move must flag an unavailable selection rather than silently default. |
| Change market | Preserve and revalidate the override, including once-per-market eligibility for the final market. |
| Cancel / restore | Keep the override on the original row. On restore validate availability; never delete historical links or answers. |
| Edit a series | Preserve overrides on existing occurrence IDs. Revalidate affected pending occurrences against final date/market. New occurrence IDs default to the central questionnaire. Do not copy the override to every future visit. |
| Series preview | Include overrides and validation/block reasons in the preview/conflict fingerprint. The existing fingerprint already includes full occurrence rows; cover the new field explicitly in tests. |
| Publish a new questionnaire version | Keep pinned references. Default-following visits use the existing effective-version rules. |
| Deactivate/archive/soft-delete questionnaire | Block while an open unstarted assignment still explicitly needs it, including a cancelled assignment that can be restored. Give a useful dependency message. Completed/history-only references remain viewable and do not require rewriting records. |
| Explicitly discard a draft | Keep the existing authorized discard behavior. Any subsequent selection/start follows the current assignment state; the feature itself never discards answers. |
| Concurrent once-per-market starts | Preserve the current submission uniqueness rules and handle a competing completion cleanly. Do not mark two visits completed for the same one-time questionnaire. |

No per-series questionnaire assignment or GM campaign behavior is introduced in this scope.

## 5. Caching and offline visits

Current SM assignment/visit caches and queued answers are real parts of the flow.

- Carry the selection descriptor through `SmDashboardSchedule` into `DashboardAssignment`; do not lose it in the existing mapping.
- The preview freshness token must cover effective questionnaire identity in addition to assignment `updatedAt`. A new global choice or publication can change the default without changing that assignment row.
- Revalidate on focus/online and before start; the backend decides which version is valid.
- Offline before start: cached information may be shown as cached, but cannot authorize starting a newly selected questionnaire.
- Offline after start: preserve the frozen submission and existing queued answers/photos. Never discard pending work by clearing storage or replacing cache keys.
- Pending mutations remain tied to their submission/question IDs. A newer planning cache must not redirect them into another graph.
- After an admin changes an override, refresh list/detail/preload metadata together. An old preview must not silently win over the authoritative start response.
- A global change can race with an open picker: save/version validation and the start precondition must produce an explicit refresh when needed.

This does not add notifications or a new offline engine.

## 6. Dashboard, counts, and exports

Use **completed/current/nondeleted submissions** and their actual linked type for reporting. Do not infer a finished visit's type from today's assignment override or central configuration.

Admin SM dashboard gets a compact questionnaire-type filter **Alle / Standard / Durcharbeit**, default **Alle**. Both the completed-visit query and OOS-answer query must apply exactly the same optional type scope. Keep existing date, region, chain, SM, and market filters.

Where type counts are displayed, distinguish **completed Fragebögen/visits** from **answered applicable questions**. Reuse current answered-count and applicability logic; do not invent a Ja-only Durcharbeit counter or count one visit twice.

OOS rules:
- Durcharbeit with OOS-configured questions feeds the same existing OOS evaluation.
- Durcharbeit without OOS questions can count as a completed visit, but remains unclassified for OOS; it is not a zero-OOS success.
- Keep original OOS denominators and time metrics. Add metadata/facets without reinterpreting existing charts.

The dashboard workbook export must use the same selected type scope and totals as the dashboard. Include a clear type/filter label so exported numbers remain explainable.

`src/lib/exports/smQuestionnaireExport.ts` exports the **authoring catalog**, not submitted visit answers. Add catalog identity to that existing export where needed; do not treat it as a visit-export implementation. FB Management/history receive type labels and matching facets; no new export subsystem is required.

Existing date semantics differ: dashboard reporting uses submission date, whereas FB Management uses work/visit dates. Preserve this behavior and document it in comparisons. Do not bundle a date-policy change into this feature.

## 7. File and surface map

Paths are relative to the frontend repository; `backend/` is its separate Git repository.

| Files / surface | Planned work |
| --- | --- |
| `backend/src/lib/schema.ts` + one reviewed additive migration | Nullable explicit override FK; no data rewrite. |
| `backend/src/sm-SMDurcharbeit-catalog.shared.ts` + a dedicated `sm-SMDurcharbeit-selection.shared.ts` | Existing stable type classifier; shared selection/validation descriptor and resolution. |
| `backend/src/routes/sm-planning.ts` | Date-aware lightweight options; batched assignment metadata; atomic occurrence edit; override-only/null changes; audit/concurrency; truthful central-assignment wording/payloads. |
| `backend/src/routes/sm-visits.ts` | Shared GET/start resolution, expected-selection check, frozen submission precedence, type metadata; reuse graph creation, answer save, upload, submit. |
| `backend/src/routes/sm-questionnaires.ts` | Extend deactivation/deletion guards to pending overrides under consistent locks; preserve editor/versioning semantics. |
| `backend/src/sm-series-management.ts`, `sm-series.shared.ts`, `sm-holiday-planning.ts` | Preserve occurrence-bound override; validate changed date/market; correct preview/conflict behavior and new-occurrence defaults. |
| `src/components/admin/sm/SmVerplanungWorkspace.tsx` | Existing dropdown in edit drawer; prefetched eligible options; read-only state after start; atomic persistence; assignment badges; accurate helper/success wording. |
| `src/components/dashboard/SmDashboardSchedule.tsx`, `AssignmentList.tsx` | Carry effective selection through mapping; card/detail type/name; fresh preload handling. `AssignmentList` currently has only the SM schedule consumer. |
| `src/components/sm/SmVisitWorkspace.tsx`, SM visit route | Start/resume/questionnaire/completion identity; refresh on stale selection; unchanged controls, timing, and validation. |
| `src/lib/api/backend.ts`, `src/types/smPlanning.ts`, `smVisit.ts` | Mutation/descriptor contracts, options, freshness tokens, cache handling without deleting queued work. |
| `backend/src/routes/sm-dashboard.ts`, `sm-dashboard.shared.ts`, `src/components/admin/sm/SmDashboardWorkspace.tsx`, `src/types/smDashboard.ts` | Type scope/counts; unchanged OOS calculations; employee summary if applicable; dashboard workbook parity. |
| `backend/src/routes/sm-management.ts`, `backend/src/sm-management.ts`, `SmFbManagementWorkspace.tsx`, `src/types/smManagement.ts` | Submission-derived type in list, facets, detail; preserve answer correction workflow. |
| `backend/src/routes/sm-activity.ts`, `src/app/(dashboard)/sm/aktivitaet/page.tsx`, `src/types/smActivity.ts` | Type in history and answer-change/deletion-request metadata without changing authorization or request outcomes. |
| `src/lib/exports/smQuestionnaireExport.ts` | Clear authoring catalog type in existing export. |
| Existing time/privacy/history consumers | Review metadata serialization and regression coverage; selection must not change time totals, payment, deletion permissions, or historical IDs. No broad rewrite. |

The existing blue catalog/editor files are dependencies to preserve and release coherently. No GM files, shared global dashboard redesign, campaign extension logic, or unrelated UI changes are planned.

## 8. Implementation order

1. **Define contracts and resolver.** Fix priority, descriptor, valid-version rules, null semantics, cache/start revision, immutable classification, and lock order.
2. **Add schema in isolated development.** Nullable override FK and optional supporting index after examining actual query shapes. No row backfill. Verify against synthetic legacy rows.
3. **Wire backend lifecycle.** Planning options/list/atomic edit and audit; preview/start; catalog guards; series/holiday edge cases. Keep old clients compatible.
4. **Wire UI.** Existing Einsatz edit dropdown and blue identity through employee schedule, start/resume, and admin management/history. Preserve editor settings and question controls.
5. **Wire reporting.** Shared type scope for queries, counts, facets, and existing exports; preserve OOS and date rules.
6. **Verify on the independent preview.** Frontend 3037/backend 4037, disposable isolated database and synthetic storage/fixtures only; never load production environment files or launch scheduled jobs.
7. **Review a release package.** Schema diff, API/UI diff, isolated test evidence, and rollback compatibility. This planning request does not authorize executing a production migration or pushing code.

Future deployment order is additive schema, compatible backend, then frontend. The schema step must be explicitly authorized and use a controlled reviewed migration; it is separate from permission to deploy application code. No seeds, cleanup, or production-answer recalculation is required.

Once overrides have actually been used, rolling back to the old global-first resolver would ignore those selections. A safe rollback hides/disables new selection controls while retaining the override-aware read/start path and all data/columns. Do not drop the column or clear assignments to roll back the UI.

## 9. Isolated acceptance checks

All cases use fresh synthetic users, assignments, questionnaires, answers, and storage. No human localhost, production credentials, or production verification queries.

- Default-only legacy assignments behave exactly as before, including old resolved version IDs.
- One selected Durcharbeit overrides a central standard questionnaire; another visit for the same SM/market remains default. Explicit standard selection and explicit reset both work.
- Every existing standard question setting works in Durcharbeit: all ten types, option/subtitle/image/comment settings, conditional logic, OOS metadata, and once-per-market. Existing snapshots remain immutable after authoring changes.
- GET preview, assignment card, start, resume, completion, management detail, and export agree on type/name/version.
- Override-only save is accepted; omitted value preserves it; null resets it. Unpublished, inactive, deleted, empty, mismatched, and date-invalid versions cannot be assigned/started.
- Date + market + SM + minutes + override commit together or all remain unchanged. Holiday-adjusted final dates are checked.
- Start versus edit/global reassignment/status change races produce one consistent result. Stale edit and stale preview fail cleanly. Test concurrent once-per-market starts and lock behavior.
- Started/resumed/submitted visits cannot have their questionnaire switched, even if assignment status/cache is stale; repeated start is idempotent.
- Cancel/restore, person reassignment, series edits/regeneration, and holiday moves retain the correct occurrence-bound selection. Newly generated visits default. Series previews become stale if an override changes.
- Referenced pending templates cannot be soft-deleted/deactivated; completed historical submissions still display the correct type after permitted catalog archival.
- Offline queues and draft photos survive cache refresh. Queued data cannot be applied to another submission. Invalid cache/start revisions trigger refresh rather than invisible selection changes.
- Dashboard type filter scopes completed visits and OOS answers consistently; no-OOS Durcharbeit stays unclassified, no double count, answered-question counts respect applicability, workbook totals match screen.
- Existing FB Management correction, activity requests, time tracking, ownership/role restrictions, and history references stay intact.
- Browser UI check: normal dropdown sizing/buttons, background option load, keyboard/search behavior, blue Durcharbeit badge, no unrelated layout changes.
- Synthetic integrity check before/after: existing assignment/submission/question/answer/file IDs and links preserved; rejected operations perform no mutations; migration requires no DML backfill.
- Historical invariance release gate: synthetic legacy history includes submitted visits, old revisions, discarded submissions, photos, corrections/audit events, and time entries. All pre-existing stored values/references remain identical after the migration and new-feature flows; unchanged historical filters produce identical existing totals, formulas, and export cells.

## 10. Risk assessment

| Risk | Severity if mishandled | Planned containment |
| --- | --- | --- |
| Central selection overwrites the explicit choice | High | Separate field; shared precedence rule; start tests. |
| Switching questionnaire after answers exist | High | Current-submission guard and frozen snapshot priority; no automatic discard. |
| Partial edits / invalid final date | High | Scoped atomic occurrence edit; final holiday/date/market validation. |
| Cached/offline preview starts different content | High | Effective-selection revision, start precondition, preserve queues. |
| Soft-deleted/inactive questionnaire strands pending visits | Medium–high | Dependency checks, restrictive FK, visible blocking state, historical joins. |
| OOS averages polluted by unrelated Durcharbeit | Medium | Existing applicability/denominators, unclassified no-OOS visits, matching type filters. |
| Existing series or time behavior changes | Medium | Single-occurrence scope, explicit series rules, regression checks. |
| Deployment/rollback compatibility | Medium–high | Additive migration, backend-before-frontend, retain resolver support on rollback. |
| UI badge/dropdown changes | Low | Reuse existing controls and blue theme, narrow additions. |

**Overall:** a manageable medium-risk feature if these boundaries are implemented together. The dangerous shortcut is treating it as only a new dropdown. The safe implementation changes assignment selection and metadata, while preserving the mature questionnaire snapshot and answer engine.

No production records, connections, application processes, or environment values were used to produce this plan.
